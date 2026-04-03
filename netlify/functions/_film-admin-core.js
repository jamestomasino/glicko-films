const fs = require('node:fs')
const path = require('node:path')
const { neon } = require('@netlify/neon')
const { connectLambda, getStore } = require('@netlify/blobs')

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const STORE_NAME = 'film-images'
const THUMB_SIZE = 'w185'
const COVER_SIZE = 'w780'

const MU = 6.5
const ELO_BASE = 1500
const ELO_SPREAD = 120
const ELO_MIN = 1200
const ELO_MAX = 1800
const VOLATILITY = 0.06

module.exports = {
  TMDB_API_BASE_URL,
  getSql,
  fetchTmdbMovie,
  searchTmdbMovies,
  seedFromRating,
  upsertFilmFromTmdb,
  cacheFilmPosters,
  formatFilm
}

function getSql () {
  return neon()
}

async function fetchTmdbMovie (tmdbId, token) {
  const url = `${TMDB_API_BASE_URL}/movie/${tmdbId}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`TMDb movie lookup failed (HTTP ${res.status})`)
  }
  return res.json()
}

async function searchTmdbMovies (query, token, page = 1) {
  const url = new URL(`${TMDB_API_BASE_URL}/search/movie`)
  url.searchParams.set('query', query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('include_adult', 'false')

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`TMDb search failed (HTTP ${res.status})`)
  }

  return res.json()
}

function seedFromRating (voteAverage, voteCount) {
  const confidence = clamp(Math.log10((voteCount ?? 0) + 1) / 3, 0, 1)
  const adjusted = confidence * voteAverage + (1 - confidence) * MU
  const eloRaw = ELO_BASE + ELO_SPREAD * (adjusted - MU)
  const eloSeed = Math.round(clamp(eloRaw, ELO_MIN, ELO_MAX))
  const glickoRd = round(clamp(220 - 80 * confidence, 140, 220), 2)

  return {
    eloSeed,
    glickoRating: eloSeed,
    glickoRd,
    glickoVolatility: VOLATILITY,
    seedAdjustedRating: round(adjusted, 4),
    seedConfidence: round(confidence, 4),
    seedModel: 'tmdb_bayes_v1'
  }
}

async function upsertFilmFromTmdb (sql, tmdbMovie) {
  const tmdbId = Number(tmdbMovie.id)
  const voteAverage = toFloat(tmdbMovie.vote_average) ?? MU
  const voteCount = toInt(tmdbMovie.vote_count) ?? 0
  const seed = seedFromRating(voteAverage, voteCount)

  const [existing] = await sql.query('select * from films where tmdb_id = $1 limit 1', [tmdbId])

  if (existing) {
    await sql.query(
      `update films
       set
         title = coalesce(nullif($1, ''), title),
         year = coalesce($2, year),
         overview = coalesce($3, overview),
         runtime = coalesce($4, runtime),
         released_on = coalesce($5, released_on),
         tmdb_vote_average = $6,
         tmdb_vote_count = $7,
         tmdb_poster_path = coalesce($8, tmdb_poster_path),
         tmdb_backdrop_path = coalesce($9, tmdb_backdrop_path),
         seed_adjusted_rating = $10,
         seed_confidence = $11,
         seed_model = $12,
         seeded_at = now(),
         elo_seed = $13,
         updated_at = now()
       where id = $14`,
      [
        tmdbMovie.title || '',
        yearFromRelease(tmdbMovie.release_date),
        tmdbMovie.overview || '',
        toInt(tmdbMovie.runtime),
        safeDate(tmdbMovie.release_date),
        voteAverage,
        voteCount,
        tmdbMovie.poster_path || null,
        tmdbMovie.backdrop_path || null,
        seed.seedAdjustedRating,
        seed.seedConfidence,
        seed.seedModel,
        seed.eloSeed,
        existing.id
      ]
    )
    const [updated] = await sql.query('select * from films where id = $1 limit 1', [existing.id])
    return { film: updated, created: false }
  }

  const traktId = await nextSyntheticTraktId(sql, tmdbId)

  const inserted = await sql.query(
    `insert into films (
      trakt_id,
      tmdb_id,
      title,
      year,
      overview,
      runtime,
      released_on,
      tmdb_vote_average,
      tmdb_vote_count,
      tmdb_poster_path,
      tmdb_backdrop_path,
      seed_adjusted_rating,
      seed_confidence,
      seed_model,
      seeded_at,
      elo_seed,
      glicko_rating,
      glicko_rd,
      glicko_volatility,
      created_at,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14, now(), $15, $16, $17, $18, now(), now()
    )
    returning *`,
    [
      traktId,
      tmdbId,
      tmdbMovie.title || 'Untitled',
      yearFromRelease(tmdbMovie.release_date),
      tmdbMovie.overview || '',
      toInt(tmdbMovie.runtime),
      safeDate(tmdbMovie.release_date),
      voteAverage,
      voteCount,
      tmdbMovie.poster_path || null,
      tmdbMovie.backdrop_path || null,
      seed.seedAdjustedRating,
      seed.seedConfidence,
      seed.seedModel,
      seed.eloSeed,
      seed.glickoRating,
      seed.glickoRd,
      seed.glickoVolatility
    ]
  )

  return { film: inserted[0], created: true }
}

async function cacheFilmPosters ({ event, sql, film, tmdbMovie, force = false }) {
  const tmdbId = Number(film.tmdb_id)
  if (!tmdbId) {
    return { cached: false, reason: 'film has no tmdb_id' }
  }

  if (!force && film.poster_thumb_blob_key && film.poster_cover_blob_key) {
    return { cached: false, reason: 'already cached' }
  }

  const posterPath = tmdbMovie?.poster_path || film.tmdb_poster_path
  if (!posterPath) {
    return { cached: false, reason: 'no poster path' }
  }

  const ext = extensionFromPosterPath(posterPath)
  const thumbURL = `${TMDB_IMAGE_BASE_URL}/${THUMB_SIZE}${posterPath}`
  const coverURL = `${TMDB_IMAGE_BASE_URL}/${COVER_SIZE}${posterPath}`
  const thumbKey = `tmdb/${tmdbId}/thumb-${THUMB_SIZE}${ext}`
  const coverKey = `tmdb/${tmdbId}/cover-${COVER_SIZE}${ext}`

  const [thumbBuf, coverBuf] = await Promise.all([
    fetchBinary(thumbURL),
    fetchBinary(coverURL)
  ])

  const store = createBlobStore(event)
  const metadataBase = {
    filmId: film.id,
    tmdbId,
    title: film.title,
    source: 'tmdb'
  }

  await store.set(thumbKey, thumbBuf, {
    metadata: { ...metadataBase, kind: 'thumb', size: THUMB_SIZE }
  })
  await store.set(coverKey, coverBuf, {
    metadata: { ...metadataBase, kind: 'cover', size: COVER_SIZE }
  })

  await sql.query(
    `update films
     set
       poster_thumb_blob_key = $1,
       poster_cover_blob_key = $2,
       poster_cached_at = now(),
       tmdb_poster_path = coalesce($3, tmdb_poster_path),
       updated_at = now()
     where id = $4`,
    [thumbKey, coverKey, posterPath, film.id]
  )

  return { cached: true, thumbKey, coverKey }
}

function formatFilm (film) {
  return {
    id: Number(film.id),
    title: film.title,
    year: film.year ? Number(film.year) : null,
    tmdbId: film.tmdb_id ? Number(film.tmdb_id) : null,
    elo: film.elo_seed ? Number(film.elo_seed) : null,
    glicko: film.glicko_rating ? Math.round(Number(film.glicko_rating)) : null,
    tmdbUrl: film.tmdb_id ? `https://www.themoviedb.org/movie/${film.tmdb_id}` : null,
    thumbnailUrl: film.poster_thumb_blob_key
      ? `/api/images?key=${encodeURIComponent(film.poster_thumb_blob_key)}`
      : null,
    coverUrl: film.poster_cover_blob_key
      ? `/api/images?key=${encodeURIComponent(film.poster_cover_blob_key)}`
      : null
  }
}

function createBlobStore (event) {
  connectLambda(event)

  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || readSiteIDFromState()
  const token = process.env.NETLIFY_BLOBS_TOKEN

  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token })
  }

  return getStore(STORE_NAME)
}

async function nextSyntheticTraktId (sql, tmdbId) {
  let candidate = -Math.abs(Number(tmdbId || 1))
  if (!Number.isInteger(candidate)) candidate = -1

  while (true) {
    const rows = await sql.query('select id from films where trakt_id = $1 limit 1', [candidate])
    if (!rows[0]) return candidate
    candidate -= 1
  }
}

async function fetchBinary (url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Image fetch failed ${url} (HTTP ${res.status})`)
  }
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

function extensionFromPosterPath (posterPath) {
  const ext = path.extname(posterPath)
  return ext || '.jpg'
}

function toInt (value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toFloat (value) {
  const parsed = Number.parseFloat(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

function yearFromRelease (releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string' || releaseDate.length < 4) return null
  const value = Number.parseInt(releaseDate.slice(0, 4), 10)
  return Number.isNaN(value) ? null : value
}

function safeDate (releaseDate) {
  if (!releaseDate || typeof releaseDate !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return null
  return releaseDate
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function round (value, places) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function readSiteIDFromState () {
  try {
    const statePath = path.resolve('.netlify/state.json')
    if (!fs.existsSync(statePath)) return null
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    return state.siteId || null
  } catch {
    return null
  }
}
