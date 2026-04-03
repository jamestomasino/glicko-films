const { neon } = require('@netlify/neon')

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100

exports.handler = async (event) => {
  try {
    const sql = neon()
    const limit = clampInt(event.queryStringParameters?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
    const offset = clampInt(event.queryStringParameters?.offset, 0, 0, Number.MAX_SAFE_INTEGER)

    const films = await sql.query(
      `with ranked as (
        select
          id,
          title,
          year,
          tmdb_id,
          poster_thumb_blob_key,
          poster_cover_blob_key,
          row_number() over (
            order by coalesce(glicko_rating, elo_seed, 1500) desc, title asc, id asc
          ) as position
        from films
      )
      select
        id,
        title,
        year,
        tmdb_id,
        poster_thumb_blob_key,
        poster_cover_blob_key,
        position
      from ranked
      order by position asc
      limit $1 offset $2`,
      [limit, offset]
    )

    const [totals] = await sql`select count(*)::int as total from films`
    const items = films.map((film) => ({
      id: Number(film.id),
      position: Number(film.position),
      title: film.title,
      year: film.year ? Number(film.year) : null,
      tmdbId: film.tmdb_id ? Number(film.tmdb_id) : null,
      tmdbUrl: film.tmdb_id ? `https://www.themoviedb.org/movie/${film.tmdb_id}` : null,
      thumbnailUrl: film.poster_thumb_blob_key
        ? `/api/images?key=${encodeURIComponent(film.poster_thumb_blob_key)}`
        : null,
      coverUrl: film.poster_cover_blob_key
        ? `/api/images?key=${encodeURIComponent(film.poster_cover_blob_key)}`
        : null
    }))

    return jsonResponse(200, {
      items,
      offset,
      limit,
      total: totals.total,
      hasMore: offset + items.length < totals.total
    })
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to load films.',
      detail: error.message
    })
  }
}

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    },
    body: JSON.stringify(body)
  }
}
