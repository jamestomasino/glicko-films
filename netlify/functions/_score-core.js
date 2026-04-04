const glicko2 = require('glicko2')
const { neon } = require('@netlify/neon')

const DEFAULT_POOL_SIZE = 12
const DEFAULT_COOLDOWN_DAYS = 30
const DEFAULT_SWISS_ROUNDS = 4
const DEFAULT_PAIRING = 'swiss'
const DEFAULT_BAND = 'normal'
const DEFAULT_RANGE = 'random'

module.exports = {
  getScoreState,
  submitScore,
  startTournament
}

async function getScoreState () {
  const sql = neon()
  let tournament = await getActiveTournament(sql)

  if (!tournament) {
    return {
      tournament: null,
      pendingCount: 0,
      matchup: null,
      needsStart: true,
      startOptions: availableStartOptions()
    }
  }

  let nextMatch = await getNextPendingMatch(sql, tournament.id)
  if (!nextMatch) {
    await applyTournamentResults(sql, tournament.id)
    return {
      tournament: {
        id: tournament.id,
        createdAt: tournament.created_at,
        strategy: tournament.strategy
      },
      pendingCount: 0,
      matchup: null,
      needsStart: true,
      justCompleted: true,
      startOptions: availableStartOptions()
    }
  }

  return {
    tournament: {
      id: tournament.id,
      createdAt: tournament.created_at,
      strategy: tournament.strategy
    },
    pendingCount: Number(nextMatch.pending_count || nextMatch.pendingCount || 0),
    matchup: mapMatch(nextMatch),
    needsStart: false,
    startOptions: availableStartOptions()
  }
}

async function startTournament ({ mode, pairing, band, range } = {}) {
  const sql = neon()
  const active = await getActiveTournament(sql)
  if (!active) {
    await createTournament(sql, { mode, pairing, band, range })
  }
  return getScoreState()
}

async function submitScore ({ matchId, tournamentId, outcome }) {
  const sql = neon()
  const scoreLow = outcomeToScoreLow(outcome)
  if (scoreLow === null) {
    throw new Error('Invalid outcome.')
  }

  const updated = await sql.query(
    `update score_matches
     set score_low = $1, rated_at = now()
     where id = $2 and tournament_id = $3 and score_low is null
     returning id`,
    [scoreLow, matchId, tournamentId]
  )

  if (updated.length === 0) {
    throw new Error('Match is already rated or does not exist.')
  }

  const [remaining] = await sql.query(
    `select count(*)::int as c
     from score_matches
     where tournament_id = $1 and score_low is null`,
    [tournamentId]
  )

  if (remaining.c === 0) {
    await applyTournamentResults(sql, tournamentId)
  }

  return getScoreState()
}

async function getActiveTournament (sql) {
  const rows = await sql.query(
    `select *
     from score_tournaments
     where status = 'active'
     order by created_at desc
     limit 1`
  )
  return rows[0] || null
}

async function createTournament (sql, { mode, pairing, band, range } = {}) {
  const selectedBand = normalizeBand(band || mode)
  const selectedPairing = normalizePairing(pairing || mode)
  const selectedRange = normalizeRange(range)
  const rdBias = parseFloatEnv('SCORE_RD_BIAS', 0.65, 0, 1)
  const cooldownDays = parseIntEnv('SCORE_PAIR_COOLDOWN_DAYS', DEFAULT_COOLDOWN_DAYS, 1, 365)
  const basePoolSize = parseIntEnv('SCORE_TOURNAMENT_POOL_SIZE', DEFAULT_POOL_SIZE, 4, 24)
  const widePoolSize = parseIntEnv('SCORE_WIDE_POOL_SIZE', Math.min(24, basePoolSize + 6), 4, 24)
  const poolSize = selectedBand === 'wide' ? widePoolSize : basePoolSize

  const films = await sql.query(
    `select
      id,
      title,
      year,
      coalesce(glicko_rating, elo_seed, 1500)::real as rating,
      coalesce(glicko_rd, 200)::real as rd,
      coalesce(glicko_volatility, 0.06)::real as vol
    from films
    order by id asc`
  )
  if (films.length < 2) {
    throw new Error('Not enough films to create a tournament.')
  }

  const recentPairs = await loadRecentPairSet(sql, cooldownDays)
  const rangeCandidates = selectRangeCandidates(films, selectedRange, poolSize)
  const sourceFilms = rangeCandidates.length >= 2 ? rangeCandidates : films
  const selectedFilms = selectedBand === 'wide'
    ? selectWideSpreadPool(sourceFilms, poolSize, recentPairs, rdBias)
    : selectSimilarityPool(sourceFilms, poolSize, recentPairs, rdBias)
  if (selectedFilms.length < 2) {
    throw new Error('Unable to build tournament pool.')
  }

  const strategy = encodeStrategy({ pairing: selectedPairing, band: selectedBand, range: selectedRange })

  const [insertedTournament] = await sql.query(
    `insert into score_tournaments (status, strategy, pool_size, cooldown_days)
     values ('active', $1, $2, $3)
     returning *`,
    [strategy, selectedFilms.length, cooldownDays]
  )

  for (const film of selectedFilms) {
    await sql.query(
      `insert into score_tournament_entries (tournament_id, film_id, start_rating, start_rd, start_volatility)
       values ($1, $2, $3, $4, $5)`,
      [insertedTournament.id, film.id, film.rating, film.rd, film.vol]
    )
  }

  const swissRounds = parseIntEnv('SCORE_SWISS_ROUNDS', DEFAULT_SWISS_ROUNDS, 2, 12)
  const pairRows = selectedPairing === 'swiss'
    ? buildSwissPairRows(selectedFilms, recentPairs, swissRounds, insertedTournament.id)
    : buildRoundRobinPairRows(selectedFilms, insertedTournament.id)

  for (const [tournamentId, lowId, highId] of pairRows) {
    await sql.query(
      `insert into score_matches (tournament_id, film_low_id, film_high_id)
       values ($1, $2, $3)`,
      [tournamentId, lowId, highId]
    )
  }

  return insertedTournament
}

async function getNextPendingMatch (sql, tournamentId) {
  const [lastRated] = await sql.query(
    `select film_low_id, film_high_id
     from score_matches
     where tournament_id = $1 and score_low is not null
     order by rated_at desc, id desc
     limit 1`,
    [tournamentId]
  )

  if (lastRated) {
    const preferred = await queryPendingMatch(sql, tournamentId, [
      Number(lastRated.film_low_id),
      Number(lastRated.film_high_id)
    ])
    if (preferred) return preferred
  }

  return queryPendingMatch(sql, tournamentId)
}

async function queryPendingMatch (sql, tournamentId, avoidFilmIds = null) {
  const params = [tournamentId]
  let avoidSql = ''

  if (Array.isArray(avoidFilmIds) && avoidFilmIds.length === 2) {
    params.push(avoidFilmIds[0], avoidFilmIds[1])
    avoidSql = `
      and m.film_low_id not in ($2, $3)
      and m.film_high_id not in ($2, $3)`
  }

  const rows = await sql.query(
    `select
      m.id as match_id,
      m.tournament_id,
      m.film_low_id,
      m.film_high_id,
      low.title as film_low_title,
      low.year as film_low_year,
      low.poster_cover_blob_key as film_low_cover,
      high.title as film_high_title,
      high.year as film_high_year,
      high.poster_cover_blob_key as film_high_cover,
      (
        select count(*)::int
        from score_matches
        where tournament_id = m.tournament_id and score_low is null
      ) as pending_count
     from score_matches m
     join films low on low.id = m.film_low_id
     join films high on high.id = m.film_high_id
     where m.tournament_id = $1 and m.score_low is null
     ${avoidSql}
     order by random()
     limit 1`,
    params
  )

  return rows[0] || null
}

async function applyTournamentResults (sql, tournamentId) {
  const entries = await sql.query(
    `select film_id, start_rating, start_rd, start_volatility
     from score_tournament_entries
     where tournament_id = $1`,
    [tournamentId]
  )
  if (entries.length === 0) {
    await sql.query(
      `update score_tournaments
       set status = 'completed', completed_at = now(), applied_at = now()
       where id = $1`,
      [tournamentId]
    )
    return
  }

  const matches = await sql.query(
    `select film_low_id, film_high_id, score_low
     from score_matches
     where tournament_id = $1 and score_low is not null`,
    [tournamentId]
  )

  const ranking = new glicko2.Glicko2({
    tau: 0.5,
    rating: 1500,
    rd: 200,
    vol: 0.06
  })

  const players = new Map()
  for (const entry of entries) {
    const player = ranking.makePlayer(
      Number(entry.start_rating),
      Number(entry.start_rd),
      Number(entry.start_volatility)
    )
    players.set(Number(entry.film_id), player)
  }

  const glickoMatches = []
  for (const match of matches) {
    const low = players.get(Number(match.film_low_id))
    const high = players.get(Number(match.film_high_id))
    if (!low || !high) continue
    glickoMatches.push([low, high, Number(match.score_low)])
  }

  ranking.updateRatings(glickoMatches)

  for (const [filmId, player] of players.entries()) {
    await sql.query(
      `update films
       set
         glicko_rating = $1,
         glicko_rd = $2,
         glicko_volatility = $3,
         updated_at = now()
       where id = $4`,
      [player.getRating(), player.getRd(), player.getVol(), filmId]
    )
  }

  await sql.query(
    `update score_tournaments
     set status = 'completed', completed_at = now(), applied_at = now()
     where id = $1`,
    [tournamentId]
  )
}

async function loadRecentPairSet (sql, cooldownDays) {
  const rows = await sql.query(
    `select film_low_id, film_high_id
     from score_matches
     where rated_at is not null
       and rated_at >= now() - ($1::text || ' days')::interval`,
    [String(cooldownDays)]
  )
  const set = new Set()
  for (const row of rows) {
    set.add(pairKey(Number(row.film_low_id), Number(row.film_high_id)))
  }
  return set
}

function selectSimilarityPool (films, poolSize, recentPairs, rdBias = 0.65) {
  const anchor = pickAnchorByRd(films, rdBias)
  const distances = films.map((film) => Math.abs(Number(film.rating) - Number(anchor.rating)))
  const maxDistance = Math.max(1, ...distances)
  const rdValues = films.map((film) => Number(film.rd) || 0)
  const maxRd = Math.max(1, ...rdValues)

  const sorted = films
    .map((film) => {
      const distanceNorm = Math.abs(Number(film.rating) - Number(anchor.rating)) / maxDistance
      const rdNorm = clamp((Number(film.rd) || 0) / maxRd, 0, 1)
      const score = distanceNorm + ((1 - rdNorm) * rdBias)
      return {
        ...film,
        score,
        rdNorm,
        jitter: Math.random()
      }
    })
    .sort((a, b) => (a.score - b.score) || (b.rdNorm - a.rdNorm) || (a.jitter - b.jitter))

  const chosen = []
  for (const candidate of sorted) {
    const valid = chosen.every((existing) => !recentPairs.has(pairKey(candidate.id, existing.id)))
    if (valid) chosen.push(candidate)
    if (chosen.length >= poolSize) break
  }

  if (chosen.length < poolSize) {
    const fallback = [...sorted].sort((a, b) => (b.rdNorm - a.rdNorm) || (a.score - b.score))
    for (const candidate of fallback) {
      if (chosen.some((film) => film.id === candidate.id)) continue
      chosen.push(candidate)
      if (chosen.length >= poolSize) break
    }
  }

  return chosen
}

function selectRangeCandidates (films, range, poolSize) {
  if (range === 'random') return films
  const sorted = [...films].sort((a, b) => Number(a.rating) - Number(b.rating))
  const minCount = Math.max(poolSize + 2, Math.ceil(sorted.length * 0.4))
  if (range === 'high') return sorted.slice(-minCount)
  if (range === 'low') return sorted.slice(0, minCount)
  const start = Math.max(0, Math.floor((sorted.length - minCount) / 2))
  return sorted.slice(start, start + minCount)
}

function selectWideSpreadPool (films, poolSize, recentPairs, rdBias = 0.65) {
  const sorted = [...films]
    .map((film) => ({ ...film, jitter: Math.random() }))
    .sort((a, b) => (Number(a.rating) - Number(b.rating)) || (a.jitter - b.jitter))

  const chosen = []
  const seen = new Set()
  let left = 0
  let right = sorted.length - 1

  while (left <= right && chosen.length < poolSize) {
    const candidates = [sorted[left], sorted[right]]
      .filter(Boolean)
      .filter((film) => !seen.has(film.id))
      .sort((a, b) => ((Number(b.rd) - Number(a.rd)) * rdBias) || (Math.abs(Number(a.rating)) - Math.abs(Number(b.rating))))

    for (const candidate of candidates) {
      const valid = chosen.every((existing) => !recentPairs.has(pairKey(candidate.id, existing.id)))
      if (!valid) continue
      chosen.push(candidate)
      seen.add(candidate.id)
      if (chosen.length >= poolSize) break
    }

    left += 1
    right -= 1
  }

  if (chosen.length < poolSize) {
    const fallback = [...sorted].sort((a, b) => Number(b.rd) - Number(a.rd))
    for (const candidate of fallback) {
      if (seen.has(candidate.id)) continue
      chosen.push(candidate)
      seen.add(candidate.id)
      if (chosen.length >= poolSize) break
    }
  }

  return chosen
}

function buildRoundRobinPairRows (films, tournamentId) {
  const pairRows = []
  for (let i = 0; i < films.length; i += 1) {
    for (let j = i + 1; j < films.length; j += 1) {
      const low = Math.min(films[i].id, films[j].id)
      const high = Math.max(films[i].id, films[j].id)
      pairRows.push([tournamentId, low, high])
    }
  }
  return pairRows
}

function buildSwissPairRows (films, recentPairs, rounds, tournamentId) {
  const sorted = [...films].sort((a, b) => Number(b.rating) - Number(a.rating))
  const schedule = buildRoundSchedule(sorted, rounds)
  const pairs = []
  const seen = new Set()

  for (const [a, b] of schedule) {
    const key = pairKey(a.id, b.id)
    if (seen.has(key)) continue
    if (recentPairs.has(key)) continue
    seen.add(key)
    pairs.push([tournamentId, Math.min(a.id, b.id), Math.max(a.id, b.id)])
  }

  if (pairs.length >= Math.max(1, Math.floor(sorted.length / 2))) {
    return pairs
  }

  const relaxed = []
  const relaxedSeen = new Set()
  for (const [a, b] of schedule) {
    const key = pairKey(a.id, b.id)
    if (relaxedSeen.has(key)) continue
    relaxedSeen.add(key)
    relaxed.push([tournamentId, Math.min(a.id, b.id), Math.max(a.id, b.id)])
  }
  return relaxed
}

function buildRoundSchedule (films, rounds) {
  const entries = [...films]
  if (entries.length % 2 !== 0) entries.push(null)
  if (entries.length < 2) return []

  const maxRounds = entries.length - 1
  const useRounds = Math.min(maxRounds, Math.max(1, rounds))
  const schedule = []

  for (let round = 0; round < useRounds; round += 1) {
    const half = entries.length / 2
    for (let i = 0; i < half; i += 1) {
      const left = entries[i]
      const right = entries[entries.length - 1 - i]
      if (!left || !right) continue
      schedule.push([left, right])
    }
    const fixed = entries[0]
    const rest = entries.slice(1)
    rest.unshift(rest.pop())
    entries.splice(0, entries.length, fixed, ...rest)
  }

  return schedule
}

function mapMatch (row) {
  return {
    matchId: Number(row.match_id),
    tournamentId: Number(row.tournament_id),
    leftFilm: {
      id: Number(row.film_low_id),
      title: row.film_low_title,
      year: row.film_low_year ? Number(row.film_low_year) : null,
      coverUrl: row.film_low_cover ? `/api/images?key=${encodeURIComponent(row.film_low_cover)}` : null
    },
    rightFilm: {
      id: Number(row.film_high_id),
      title: row.film_high_title,
      year: row.film_high_year ? Number(row.film_high_year) : null,
      coverUrl: row.film_high_cover ? `/api/images?key=${encodeURIComponent(row.film_high_cover)}` : null
    }
  }
}

function pairKey (a, b) {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  return `${low}:${high}`
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function outcomeToScoreLow (outcome) {
  if (outcome === 'left') return 1
  if (outcome === 'draw') return 0.5
  if (outcome === 'right') return 0
  return null
}

function parseIntEnv (name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function parseFloatEnv (name, fallback, min, max) {
  const parsed = Number.parseFloat(process.env[name] || '')
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function pickAnchorByRd (films, rdBias = 0.65) {
  if (films.length === 0) return null
  if (rdBias <= 0) return films[Math.floor(Math.random() * films.length)]

  const weights = films.map((film) => 1 + ((Number(film.rd) || 0) * rdBias))
  const total = weights.reduce((sum, value) => sum + value, 0)
  let target = Math.random() * total
  for (let i = 0; i < films.length; i += 1) {
    target -= weights[i]
    if (target <= 0) return films[i]
  }
  return films[films.length - 1]
}

function normalizePairing (value) {
  if (value === 'swiss') return 'swiss'
  if (value === 'round_robin') return 'round_robin'
  if (value === 'normal' || value === 'wide') return 'round_robin'
  return DEFAULT_PAIRING
}

function normalizeBand (value) {
  if (value === 'wide') return 'wide'
  if (value === 'normal') return 'normal'
  return DEFAULT_BAND
}

function normalizeRange (value) {
  if (value === 'high' || value === 'middle' || value === 'low') return value
  return DEFAULT_RANGE
}

function encodeStrategy ({ pairing, band, range }) {
  const pairingCode = pairing === 'swiss' ? 'sw' : 'rr'
  const bandCode = band === 'wide' ? 'w' : 'n'
  const rangeCode = range === 'high'
    ? 'h'
    : range === 'middle'
      ? 'm'
      : range === 'low'
        ? 'l'
        : 'r'
  return `v2_${pairingCode}${bandCode}${rangeCode}`
}

function availableStartOptions () {
  return {
    defaults: {
      pairing: DEFAULT_PAIRING,
      band: DEFAULT_BAND,
      range: DEFAULT_RANGE
    },
    pairing: [
      { id: 'round_robin', label: 'Full Pairing', description: 'Every film in the pool faces every other film.' },
      { id: 'swiss', label: 'Swiss Rules', description: 'Fewer seeded rounds, faster tournament completion.' }
    ],
    band: [
      { id: 'normal', label: 'Normal Band', description: 'Standard rating spread.' },
      { id: 'wide', label: 'Wide Band', description: 'Larger rating spread in each tournament pool.' }
    ],
    range: [
      { id: 'random', label: 'Random Range', description: 'No Elo targeting; sample across the catalog.' },
      { id: 'high', label: 'High Range', description: 'Focus near higher Elo films.' },
      { id: 'middle', label: 'Middle Range', description: 'Focus around mid Elo films.' },
      { id: 'low', label: 'Low Range', description: 'Focus near lower Elo films.' }
    ]
  }
}
