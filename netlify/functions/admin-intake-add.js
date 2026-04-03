const { requireAdmin } = require('./_admin-guard')
const { getSql, fetchTmdbMovie, upsertFilmFromTmdb, cacheFilmPosters, formatFilm } = require('./_film-admin-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  const token = process.env.TMDB_API_ACCESS_TOKEN
  if (!token) {
    return jsonResponse(500, { error: 'TMDB_API_ACCESS_TOKEN is not configured.' })
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const tmdbId = Number(body.tmdbId)
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return jsonResponse(400, { error: 'tmdbId must be a positive integer.' })
    }

    const tmdbMovie = await fetchTmdbMovie(tmdbId, token)
    if (!tmdbMovie) {
      return jsonResponse(404, { error: 'TMDb movie not found.' })
    }

    const sql = getSql()
    const upserted = await upsertFilmFromTmdb(sql, tmdbMovie)
    const cache = await cacheFilmPosters({ event, sql, film: upserted.film, tmdbMovie, force: true })
    const [fresh] = await sql.query('select * from films where id = $1 limit 1', [upserted.film.id])

    console.info('admin-intake-add success', {
      filmId: upserted.film.id,
      tmdbId,
      created: upserted.created,
      cached: cache.cached
    })

    return jsonResponse(200, {
      ok: true,
      created: upserted.created,
      cached: cache.cached,
      cacheReason: cache.reason || null,
      film: formatFilm(fresh)
    })
  } catch (error) {
    console.error('admin-intake-add failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to add film.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
