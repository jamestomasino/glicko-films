const { requireAdmin } = require('./_admin-guard')
const { getSql, formatFilm } = require('./_film-admin-core')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

const RESET_RD = 200
const RESET_VOLATILITY = 0.06
const ELO_MIN = 600
const ELO_MAX = 3000

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  const body = JSON.parse(event.body || '{}')
  const filmId = Number(body.filmId)
  const tmdbId = Number(body.tmdbId)
  const elo = Number(body.elo)

  if (!Number.isFinite(elo)) {
    return noStoreJsonResponse(400, { error: 'elo must be a number.' })
  }
  const manualElo = Math.round(elo)
  if (!Number.isInteger(manualElo) || manualElo < ELO_MIN || manualElo > ELO_MAX) {
    return noStoreJsonResponse(400, { error: `elo must be between ${ELO_MIN} and ${ELO_MAX}.` })
  }

  const sql = getSql()
  let film
  if (Number.isInteger(filmId) && filmId > 0) {
    ;[film] = await sql.query('select * from films where id = $1 limit 1', [filmId])
  } else if (Number.isInteger(tmdbId) && tmdbId > 0) {
    ;[film] = await sql.query('select * from films where tmdb_id = $1 limit 1', [tmdbId])
  } else {
    return noStoreJsonResponse(400, { error: 'filmId or tmdbId is required.' })
  }

  if (!film) {
    return noStoreJsonResponse(404, { error: 'Film not found.' })
  }

    const deletedMatches = await sql.query(
      `delete from score_matches
       where film_low_id = $1 or film_high_id = $1
       returning id`,
      [film.id]
    )

    await sql.query(
      `update score_tournament_entries e
       set
         start_rating = $1,
         start_rd = $2,
         start_volatility = $3
       from score_tournaments t
       where
         e.tournament_id = t.id
         and t.status = 'active'
         and e.film_id = $4`,
      [manualElo, RESET_RD, RESET_VOLATILITY, film.id]
    )

    await sql.query(
      `update films
       set
         elo_seed = $1::int,
         glicko_rating = $1::real,
         glicko_rd = $2::real,
         glicko_volatility = $3::real,
         seed_model = 'manual_admin_v1',
         seeded_at = now(),
         updated_at = now()
       where id = $4`,
      [manualElo, RESET_RD, RESET_VOLATILITY, film.id]
    )

  const [updated] = await sql.query('select * from films where id = $1 limit 1', [film.id])
  console.info('admin-set-elo success', { filmId: film.id, tmdbId: film.tmdb_id || null, elo: manualElo, deletedMatches: deletedMatches.length })

  return noStoreJsonResponse(200, {
    ok: true,
    film: formatFilm(updated),
    elo: manualElo,
    deletedMatchCount: deletedMatches.length
  })
}, { source: 'admin-set-elo', message: 'Failed to set Elo.', noStore: true })
