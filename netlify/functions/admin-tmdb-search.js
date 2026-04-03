const { requireAdmin } = require('./_admin-guard')
const { getSql, searchTmdbMovies } = require('./_film-admin-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  const token = process.env.TMDB_API_ACCESS_TOKEN
  if (!token) {
    return jsonResponse(500, { error: 'TMDB_API_ACCESS_TOKEN is not configured.' })
  }

  try {
    const query = String(event.queryStringParameters?.q || '').trim()
    if (query.length < 2) {
      return jsonResponse(400, { error: 'Query must be at least 2 characters.' })
    }

    const payload = await searchTmdbMovies(query, token, 1)
    const results = Array.isArray(payload.results) ? payload.results.slice(0, 12) : []

    const tmdbIds = results
      .map((movie) => Number(movie.id))
      .filter((id) => Number.isInteger(id) && id > 0)

    let existingByTmdb = new Map()
    if (tmdbIds.length > 0) {
      const sql = getSql()
      const rows = await sql.query('select id, tmdb_id, title from films where tmdb_id = any($1::int[])', [tmdbIds])
      existingByTmdb = new Map(rows.map((row) => [Number(row.tmdb_id), { id: Number(row.id), title: row.title }]))
    }

    return jsonResponse(200, {
      query,
      items: results.map((movie) => {
        const tmdbId = Number(movie.id)
        const release = movie.release_date || null
        const year = release && release.length >= 4 ? Number.parseInt(release.slice(0, 4), 10) : null
        const existing = existingByTmdb.get(tmdbId) || null
        return {
          tmdbId,
          title: movie.title || 'Untitled',
          year: Number.isNaN(year) ? null : year,
          releaseDate: release,
          posterPath: movie.poster_path || null,
          voteAverage: typeof movie.vote_average === 'number' ? movie.vote_average : null,
          voteCount: typeof movie.vote_count === 'number' ? movie.vote_count : null,
          overview: movie.overview || '',
          existing,
          tmdbUrl: `https://www.themoviedb.org/movie/${tmdbId}`
        }
      })
    })
  } catch (error) {
    console.error('admin-tmdb-search failed', { message: error.message })
    return jsonResponse(500, { error: 'TMDb search failed.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
