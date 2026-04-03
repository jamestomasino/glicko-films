import fs from 'node:fs'
import path from 'node:path'
import { getStore } from '@netlify/blobs'
import { neon } from '@netlify/neon'

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const STORE_NAME = 'film-images'
const THUMB_SIZE = 'w185'
const COVER_SIZE = 'w780'

const force = process.argv.includes('--force')
const limit = parseIntArg('--limit')
const filmIdFilter = parseIntArg('--film-id')
const tmdbIdFilter = parseIntArg('--tmdb-id')

const tmdbToken = process.env.TMDB_API_ACCESS_TOKEN
const blobsToken = process.env.NETLIFY_BLOBS_TOKEN
const siteID = process.env.NETLIFY_SITE_ID || readSiteIDFromState()

if (!process.env.NETLIFY_DATABASE_URL) {
  console.error('NETLIFY_DATABASE_URL is required.')
  process.exit(1)
}
if (!tmdbToken) {
  console.error('TMDB_API_ACCESS_TOKEN is required.')
  process.exit(1)
}
if (!blobsToken) {
  console.error('NETLIFY_BLOBS_TOKEN is required.')
  process.exit(1)
}
if (!siteID) {
  console.error('Netlify site ID is required (NETLIFY_SITE_ID or .netlify/state.json).')
  process.exit(1)
}

const sql = neon()
const store = getStore({
  name: STORE_NAME,
  siteID,
  token: blobsToken
})

const { rows: filmRows, totalRows } = await loadFilms(sql, {
  filmId: filmIdFilter,
  tmdbId: tmdbIdFilter,
  limit
})
console.log(`Found ${totalRows} films (${filmRows.length} selected for this run).`)

let cached = 0
let skippedAlreadyCached = 0
let skippedNoTmdbId = 0
let skippedNoPoster = 0
let failed = 0

for (let i = 0; i < filmRows.length; i += 1) {
  const film = filmRows[i]
  const progress = `${i + 1}/${filmRows.length}`

  if (!film.tmdb_id) {
    skippedNoTmdbId += 1
    continue
  }

  if (!force && film.poster_thumb_blob_key && film.poster_cover_blob_key) {
    skippedAlreadyCached += 1
    continue
  }

  try {
    let posterPath = film.tmdb_poster_path

    if (!posterPath) {
      const tmdbMovie = await fetchTmdbMovie(film.tmdb_id, tmdbToken)
      posterPath = tmdbMovie?.poster_path || null
      if (posterPath) {
        await sql.query(
          `update films
           set tmdb_poster_path = coalesce($1, tmdb_poster_path),
               tmdb_backdrop_path = coalesce($2, tmdb_backdrop_path),
               updated_at = now()
           where id = $3`,
          [posterPath, tmdbMovie?.backdrop_path || null, film.id]
        )
      }
    }

    if (!posterPath) {
      skippedNoPoster += 1
      continue
    }

    const ext = extensionFromPosterPath(posterPath)
    const thumbURL = `${TMDB_IMAGE_BASE_URL}/${THUMB_SIZE}${posterPath}`
    const coverURL = `${TMDB_IMAGE_BASE_URL}/${COVER_SIZE}${posterPath}`
    const thumbKey = `tmdb/${film.tmdb_id}/thumb-${THUMB_SIZE}${ext}`
    const coverKey = `tmdb/${film.tmdb_id}/cover-${COVER_SIZE}${ext}`

    const [thumbBuf, coverBuf] = await Promise.all([
      fetchBinary(thumbURL),
      fetchBinary(coverURL)
    ])

    const metadataBase = {
      filmId: film.id,
      tmdbId: film.tmdb_id,
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
         updated_at = now()
       where id = $3`,
      [thumbKey, coverKey, film.id]
    )

    cached += 1
    if ((i + 1) % 100 === 0) {
      console.log(`Cached ${progress}`)
    }
  } catch (error) {
    failed += 1
    console.error(`Failed ${progress} (${film.title} / tmdb:${film.tmdb_id}):`, error.message)
  }
}

const [summary] = await sql`
  select
    count(*)::int as total,
    count(*) filter (where poster_thumb_blob_key is not null and poster_cover_blob_key is not null)::int as fully_cached
  from films
`

console.log(
  JSON.stringify(
    {
      totalFilms: summary.total,
      fullyCachedFilms: summary.fully_cached,
      cached,
      skippedAlreadyCached,
      skippedNoTmdbId,
      skippedNoPoster,
      failed
    },
    null,
    2
  )
)

async function fetchTmdbMovie (tmdbId, bearerToken) {
  const url = `${TMDB_API_BASE_URL}/movie/${tmdbId}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json'
    }
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`TMDb movie lookup failed (HTTP ${res.status})`)
  return res.json()
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

function parseIntArg (flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  const value = Number.parseInt(process.argv[index + 1], 10)
  return Number.isNaN(value) ? null : value
}

async function loadFilms (sqlClient, options) {
  const where = []
  const params = []

  if (options.filmId) {
    where.push(`id = $${params.length + 1}`)
    params.push(options.filmId)
  }
  if (options.tmdbId) {
    where.push(`tmdb_id = $${params.length + 1}`)
    params.push(options.tmdbId)
  }

  let text = `select
    id,
    tmdb_id,
    title,
    tmdb_poster_path,
    poster_thumb_blob_key,
    poster_cover_blob_key
  from films`

  if (where.length > 0) {
    text += ` where ${where.join(' and ')}`
  }
  text += ' order by id asc'

  if (options.limit) {
    text += ` limit $${params.length + 1}`
    params.push(options.limit)
  }

  const rows = await sqlClient.query(text, params)

  const countText = `select count(*)::int as c from films${where.length > 0 ? ` where ${where.join(' and ')}` : ''}`
  const countRows = await sqlClient.query(countText, params.slice(0, where.length))
  const totalRows = countRows[0]?.c ?? rows.length

  return { rows, totalRows }
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
