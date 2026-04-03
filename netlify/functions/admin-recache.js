const { requireAdmin } = require('./_admin-guard')
const { getSql, fetchTmdbMovie, cacheFilmPosters, formatFilm } = require('./_film-admin-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  const token = process.env.TMDB_API_ACCESS_TOKEN
  if (!token) {
    return jsonResponse(500, { error: 'TMDB_API_ACCESS_TOKEN is not configured.' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const filmId = Number(body.filmId)
    const tmdbId = Number(body.tmdbId)
    const force = Boolean(body.force)

    const sql = getSql()
    let film
    if (Number.isInteger(filmId) && filmId > 0) {
      ;[film] = await sql.query('select * from films where id = $1 limit 1', [filmId])
    } else if (Number.isInteger(tmdbId) && tmdbId > 0) {
      ;[film] = await sql.query('select * from films where tmdb_id = $1 limit 1', [tmdbId])
    }

    if (!film) {
      return jsonResponse(404, { error: 'Film not found.' })
    }
    if (!film.tmdb_id) {
      return jsonResponse(400, { error: 'Film has no TMDb ID.' })
    }

    const tmdbMovie = await fetchTmdbMovie(film.tmdb_id, token)
    const cache = await cacheFilmPosters({ event, sql, film, tmdbMovie, force })
    const [fresh] = await sql.query('select * from films where id = $1 limit 1', [film.id])

    console.info('admin-recache success', { filmId: film.id, tmdbId: film.tmdb_id, force, cached: cache.cached })

    return jsonResponse(200, {
      ok: true,
      cached: cache.cached,
      reason: cache.reason || null,
      film: formatFilm(fresh)
    })
  } catch (error) {
    console.error('admin-recache failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to recache film images.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
