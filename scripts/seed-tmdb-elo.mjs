import { neon } from '@netlify/neon'

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const SEED_MODEL = 'tmdb_bayes_v1'
const FALLBACK_MODEL_NO_TMDB = 'fallback_no_tmdb_v1'
const FALLBACK_MODEL_NOT_FOUND = 'fallback_tmdb_not_found_v1'
const FALLBACK_MODEL_ERROR = 'fallback_tmdb_error_v1'

const MU = 6.5
const ELO_BASE = 1500
const ELO_SPREAD = 120
const ELO_MIN = 1200
const ELO_MAX = 1800
const VOLATILITY = 0.06

const tmdbToken = process.env.TMDB_API_ACCESS_TOKEN
if (!process.env.NETLIFY_DATABASE_URL) {
  console.error('NETLIFY_DATABASE_URL is required.')
  process.exit(1)
}
if (!tmdbToken) {
  console.error('TMDB_API_ACCESS_TOKEN is required.')
  process.exit(1)
}

const sql = neon()
const films = await sql`select id, tmdb_id, title from films order by id asc`
console.log(`Found ${films.length} films to seed.`)

let seededFromTmdb = 0
let fallbackNoTmdb = 0
let fallbackNotFound = 0
let failures = 0

for (let i = 0; i < films.length; i += 1) {
  const film = films[i]
  const progress = `${i + 1}/${films.length}`

  if (!film.tmdb_id) {
    const seed = seedFromRating(MU, 0)
    await applySeed(film.id, {
      tmdbVoteAverage: null,
      tmdbVoteCount: null,
      ...seed,
      seedModel: FALLBACK_MODEL_NO_TMDB
    })
    fallbackNoTmdb += 1
    continue
  }

  try {
    const movie = await fetchTmdbMovie(film.tmdb_id, tmdbToken)
    if (!movie) {
      const seed = seedFromRating(MU, 0)
      await applySeed(film.id, {
        tmdbVoteAverage: null,
        tmdbVoteCount: null,
        ...seed,
        seedModel: FALLBACK_MODEL_NOT_FOUND
      })
      fallbackNotFound += 1
      continue
    }

    const voteAverage = toFloat(movie.vote_average) ?? MU
    const voteCount = toInt(movie.vote_count) ?? 0
    const seed = seedFromRating(voteAverage, voteCount)

    await applySeed(film.id, {
      tmdbVoteAverage: voteAverage,
      tmdbVoteCount: voteCount,
      tmdbPosterPath: movie.poster_path ?? null,
      tmdbBackdropPath: movie.backdrop_path ?? null,
      ...seed,
      seedModel: SEED_MODEL
    })

    seededFromTmdb += 1
    if ((i + 1) % 100 === 0) {
      console.log(`Seeded ${progress}`)
    }
  } catch (error) {
    failures += 1
    console.error(`Failed seeding ${progress} (${film.title} / tmdb:${film.tmdb_id}):`, error.message)
    const seed = seedFromRating(MU, 0)
    await applySeed(film.id, {
      tmdbVoteAverage: null,
      tmdbVoteCount: null,
      tmdbPosterPath: null,
      tmdbBackdropPath: null,
      ...seed,
      seedModel: FALLBACK_MODEL_ERROR
    })
  }
}

const [summary] = await sql`
  select
    count(*)::int as total,
    count(*) filter (where elo_seed is not null)::int as seeded,
    min(elo_seed)::int as min_elo,
    max(elo_seed)::int as max_elo,
    round(avg(elo_seed)::numeric, 2) as avg_elo
  from films
`

console.log('Seeding complete.')
console.log(
  JSON.stringify(
    {
      totalFilms: summary.total,
      seededFilms: summary.seeded,
      seededFromTmdb,
      fallbackNoTmdb,
      fallbackNotFound,
      failures,
      eloRange: { min: summary.min_elo, max: summary.max_elo, avg: Number(summary.avg_elo) }
    },
    null,
    2
  )
)

function seedFromRating (voteAverage, voteCount) {
  const confidence = clamp(Math.log10((voteCount ?? 0) + 1) / 3, 0, 1)
  const adjusted = confidence * voteAverage + (1 - confidence) * MU
  const eloRaw = ELO_BASE + ELO_SPREAD * ((adjusted - MU) / 1.0)
  const eloSeed = Math.round(clamp(eloRaw, ELO_MIN, ELO_MAX))
  const glickoRd = round(clamp(220 - 80 * confidence, 140, 220), 2)

  return {
    eloSeed,
    glickoRating: eloSeed,
    glickoRd,
    glickoVolatility: VOLATILITY,
    seedAdjustedRating: round(adjusted, 4),
    seedConfidence: round(confidence, 4)
  }
}

async function applySeed (filmId, seed) {
  await sql.query(
    `update films
     set
       tmdb_vote_average = $1,
       tmdb_vote_count = $2,
       tmdb_poster_path = coalesce($3, tmdb_poster_path),
       tmdb_backdrop_path = coalesce($4, tmdb_backdrop_path),
       seed_adjusted_rating = $5,
       seed_confidence = $6,
       seed_model = $7,
       seeded_at = now(),
       elo_seed = $8,
       glicko_rating = $9,
       glicko_rd = $10,
       glicko_volatility = $11,
       updated_at = now()
     where id = $12`,
    [
      seed.tmdbVoteAverage,
      seed.tmdbVoteCount,
      seed.tmdbPosterPath,
      seed.tmdbBackdropPath,
      seed.seedAdjustedRating,
      seed.seedConfidence,
      seed.seedModel,
      seed.eloSeed,
      seed.glickoRating,
      seed.glickoRd,
      seed.glickoVolatility,
      filmId
    ]
  )
}

async function fetchTmdbMovie (tmdbId, bearerToken) {
  const url = `${TMDB_API_BASE_URL}/movie/${tmdbId}`

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/json'
      }
    })

    if (res.status === 404) {
      return null
    }

    if (res.ok) {
      return res.json()
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(400 * attempt)
      continue
    }

    throw new Error(`TMDb request failed for id ${tmdbId}: HTTP ${res.status}`)
  }

  return null
}

function toInt (value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toFloat (value) {
  const parsed = Number.parseFloat(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function round (value, places) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
