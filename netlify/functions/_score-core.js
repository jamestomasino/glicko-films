const glicko2 = require('glicko2')
const { neon } = require('@netlify/neon')

const DEFAULT_POOL_SIZE = 12
const DEFAULT_COOLDOWN_DAYS = 30

module.exports = {
  getScoreState,
  submitScore
}

async function getScoreState () {
  const sql = neon()
  let tournament = await getActiveTournament(sql)

  if (!tournament) {
    tournament = await createTournament(sql)
  }

  let nextMatch = await getNextPendingMatch(sql, tournament.id)
  if (!nextMatch) {
    await applyTournamentResults(sql, tournament.id)
    tournament = await createTournament(sql)
    nextMatch = await getNextPendingMatch(sql, tournament.id)
  }

  return {
    tournament: {
      id: tournament.id,
      createdAt: tournament.created_at
    },
    pendingCount: nextMatch.pendingCount,
    matchup: mapMatch(nextMatch)
  }
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

async function createTournament (sql) {
  const cooldownDays = parseIntEnv('SCORE_PAIR_COOLDOWN_DAYS', DEFAULT_COOLDOWN_DAYS, 1, 365)
  const poolSize = parseIntEnv('SCORE_TOURNAMENT_POOL_SIZE', DEFAULT_POOL_SIZE, 4, 24)

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
  const selectedFilms = selectSimilarityPool(films, poolSize, recentPairs)
  if (selectedFilms.length < 2) {
    throw new Error('Unable to build tournament pool.')
  }

  const [insertedTournament] = await sql.query(
    `insert into score_tournaments (status, strategy, pool_size, cooldown_days)
     values ('active', 'similarity_v1', $1, $2)
     returning *`,
    [selectedFilms.length, cooldownDays]
  )

  for (const film of selectedFilms) {
    await sql.query(
      `insert into score_tournament_entries (tournament_id, film_id, start_rating, start_rd, start_volatility)
       values ($1, $2, $3, $4, $5)`,
      [insertedTournament.id, film.id, film.rating, film.rd, film.vol]
    )
  }

  const pairRows = []
  for (let i = 0; i < selectedFilms.length; i += 1) {
    for (let j = i + 1; j < selectedFilms.length; j += 1) {
      const low = Math.min(selectedFilms[i].id, selectedFilms[j].id)
      const high = Math.max(selectedFilms[i].id, selectedFilms[j].id)
      pairRows.push([insertedTournament.id, low, high])
    }
  }

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
     order by m.id asc
     limit 1`,
    [tournamentId]
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

function selectSimilarityPool (films, poolSize, recentPairs) {
  const anchor = films[Math.floor(Math.random() * films.length)]
  const sorted = films
    .map((film) => ({
      ...film,
      distance: Math.abs(Number(film.rating) - Number(anchor.rating)),
      jitter: Math.random()
    }))
    .sort((a, b) => (a.distance - b.distance) || (a.jitter - b.jitter))

  const chosen = []
  for (const candidate of sorted) {
    const valid = chosen.every((existing) => !recentPairs.has(pairKey(candidate.id, existing.id)))
    if (valid) chosen.push(candidate)
    if (chosen.length >= poolSize) break
  }

  if (chosen.length < poolSize) {
    for (const candidate of sorted) {
      if (chosen.some((film) => film.id === candidate.id)) continue
      chosen.push(candidate)
      if (chosen.length >= poolSize) break
    }
  }

  return chosen
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
