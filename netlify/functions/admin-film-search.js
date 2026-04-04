const { requireAdmin } = require('./_admin-guard')
const { getSql, formatFilm } = require('./_film-admin-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  try {
    const query = String(event.queryStringParameters?.q || '').trim()
    const limit = clampInt(event.queryStringParameters?.limit, 20, 1, 50)
    if (!query) {
      return jsonResponse(200, { ok: true, items: [] })
    }

    const sql = getSql()
    const like = `%${query}%`
    const rows = await sql.query(
      `with match_counts as (
        select
          film_id,
          count(*)::int as matches_count
        from (
          select film_low_id as film_id from score_matches where rated_at is not null
          union all
          select film_high_id as film_id from score_matches where rated_at is not null
        ) paired
        group by film_id
      )
      select
        f.*,
        coalesce(mc.matches_count, 0)::int as matches_count
      from films f
      left join match_counts mc on mc.film_id = f.id
      where
        cast(f.id as text) = $1
        or cast(f.tmdb_id as text) = $1
        or f.title ilike $2
      order by
        case
          when cast(f.id as text) = $1 then 0
          when cast(f.tmdb_id as text) = $1 then 1
          when lower(f.title) = lower($1) then 2
          when lower(f.title) like lower($2) then 3
          else 4
        end,
        coalesce(f.glicko_rating, f.elo_seed, 1500) desc,
        f.title asc,
        f.id asc
      limit $3`,
      [query, like, limit]
    )

    const items = rows.map((row) => ({
      ...formatFilm(row),
      matches: Number(row.matches_count || 0)
    }))

    return jsonResponse(200, { ok: true, items })
  } catch (error) {
    console.error('admin-film-search failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to search films.', detail: error.message })
  }
}

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
