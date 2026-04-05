const { neon } = require('@netlify/neon')
const { jsonResponse, withErrorHandling } = require('./_http')

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100

exports.handler = withErrorHandling(async (event) => {
  const sql = neon()
  const limit = clampInt(event.queryStringParameters?.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = clampInt(event.queryStringParameters?.offset, 0, 0, Number.MAX_SAFE_INTEGER)

    const films = await sql.query(
      `with match_counts as (
        select
          film_id,
          count(*)::int as matches_count
        from (
          select film_low_id as film_id
          from score_matches
          where rated_at is not null
          union all
          select film_high_id as film_id
          from score_matches
          where rated_at is not null
        ) paired
        group by film_id
      ),
      ranked as (
        select
          f.id,
          f.title,
          f.year,
          f.tmdb_id,
          f.poster_thumb_blob_key,
          f.poster_cover_blob_key,
          coalesce(f.glicko_rating, f.elo_seed, 1500) as rating_value,
          f.glicko_rd,
          coalesce(mc.matches_count, 0) as matches_count,
          row_number() over (
            order by coalesce(f.glicko_rating, f.elo_seed, 1500) desc, f.title asc, f.id asc
          ) as position
        from films f
        left join match_counts mc on mc.film_id = f.id
      )
      select
        id,
        title,
        year,
        tmdb_id,
        poster_thumb_blob_key,
        poster_cover_blob_key,
        rating_value,
        glicko_rd,
        matches_count,
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
      elo: Math.round(Number(film.rating_value || 1500)),
      rd: film.glicko_rd ? Math.round(Number(film.glicko_rd)) : null,
      matches: Number(film.matches_count || 0),
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
  }, { 'cache-control': 'public, max-age=60' })
}, { source: 'films', message: 'Failed to load films.' })

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
