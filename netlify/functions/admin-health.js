const { requireAdmin } = require('./_admin-guard')
const { getSql } = require('./_film-admin-core')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  const sql = getSql()
  const [counts] = await sql.query(
    `select
        count(*)::int as film_count,
        count(*) filter (where tmdb_id is not null)::int as with_tmdb,
        count(*) filter (where poster_thumb_blob_key is not null and poster_cover_blob_key is not null)::int as fully_cached,
        count(*) filter (where glicko_rating is not null)::int as with_glicko
       from films`
  )

  const [scoreCounts] = await sql.query(
    `select
        count(*)::int as tournaments,
        count(*) filter (where status = 'active')::int as active_tournaments,
        coalesce(sum(case when status = 'active' then 1 else 0 end), 0)::int as active_sum
       from score_tournaments`
  )

  const [pending] = await sql.query(
    `select count(*)::int as pending
       from score_matches m
       join score_tournaments t on t.id = m.tournament_id
       where t.status = 'active' and m.score_low is null`
  )

  return noStoreJsonResponse(200, {
    ok: true,
    timestamp: new Date().toISOString(),
    films: {
      total: Number(counts.film_count || 0),
      withTmdb: Number(counts.with_tmdb || 0),
      fullyCached: Number(counts.fully_cached || 0),
      withGlicko: Number(counts.with_glicko || 0)
    },
    scoring: {
      tournaments: Number(scoreCounts.tournaments || 0),
      activeTournaments: Number(scoreCounts.active_tournaments || 0),
      activePendingMatches: Number(pending.pending || 0)
    }
  })
}, { source: 'admin-health', message: 'Failed to load admin health.', noStore: true })
