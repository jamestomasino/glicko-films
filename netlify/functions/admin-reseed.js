const { requireAdmin } = require('./_admin-guard')
const { getSql, fetchTmdbMovie, seedFromRating, formatFilm } = require('./_film-admin-core')

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
    const resetGlicko = Boolean(body.resetGlicko)

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
    if (!tmdbMovie) {
      return jsonResponse(404, { error: 'TMDb movie not found.' })
    }

    const voteAverage = Number.isFinite(Number(tmdbMovie.vote_average)) ? Number(tmdbMovie.vote_average) : 6.5
    const voteCount = Number.isInteger(Number(tmdbMovie.vote_count)) ? Number(tmdbMovie.vote_count) : 0
    const seed = seedFromRating(voteAverage, voteCount)

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
         glicko_rating = case when $9 then $10 else glicko_rating end,
         glicko_rd = case when $9 then $11 else glicko_rd end,
         glicko_volatility = case when $9 then $12 else glicko_volatility end,
         updated_at = now()
       where id = $13`,
      [
        voteAverage,
        voteCount,
        tmdbMovie.poster_path || null,
        tmdbMovie.backdrop_path || null,
        seed.seedAdjustedRating,
        seed.seedConfidence,
        seed.seedModel,
        seed.eloSeed,
        resetGlicko,
        seed.glickoRating,
        seed.glickoRd,
        seed.glickoVolatility,
        film.id
      ]
    )

    const [updated] = await sql.query('select * from films where id = $1 limit 1', [film.id])

    console.info('admin-reseed success', { filmId: film.id, tmdbId: film.tmdb_id, resetGlicko })

    return jsonResponse(200, {
      ok: true,
      resetGlicko,
      film: formatFilm(updated)
    })
  } catch (error) {
    console.error('admin-reseed failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to reseed film.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
