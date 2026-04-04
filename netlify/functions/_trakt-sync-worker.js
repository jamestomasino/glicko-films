const { fetchTmdbMovie, upsertFilmFromTmdb, cacheFilmPosters } = require('./_film-admin-core')
const { fetchSyncState, saveSyncState, traktAuthedGet } = require('./_trakt-core')

module.exports = {
  runTraktSyncJob
}

async function runTraktSyncJob ({ event, sql, job, payload = {} }) {
  const syncState = await fetchSyncState(sql)
  const since = payload.since || syncState?.last_synced_at || null
  const pageLimit = clampInt(payload.maxPages, Number(process.env.TRAKT_SYNC_MAX_PAGES || 10), 1, 50)
  const perPage = clampInt(payload.perPage, Number(process.env.TRAKT_SYNC_PAGE_SIZE || 100), 10, 100)

  let page = 1
  let totalImported = 0
  let totalEventsInserted = 0
  let totalFilmsCreated = 0
  let latestWatchedAt = since
  let latestHistoryId = syncState?.last_history_id ? Number(syncState.last_history_id) : null

  while (page <= pageLimit) {
    const { data: historyRows, pagination } = await traktAuthedGet(sql, '/users/me/history/movies', {
      page,
      limit: perPage,
      start_at: since
    })

    if (!Array.isArray(historyRows) || historyRows.length === 0) break

    for (const row of historyRows) {
      const handled = await ingestHistoryRow({ event, sql, row })
      totalImported += 1
      totalEventsInserted += handled.eventInserted ? 1 : 0
      totalFilmsCreated += handled.created ? 1 : 0

      if (handled.watchedAt && (!latestWatchedAt || new Date(handled.watchedAt) > new Date(latestWatchedAt))) {
        latestWatchedAt = handled.watchedAt
      }
      if (handled.historyId && (!latestHistoryId || handled.historyId > latestHistoryId)) {
        latestHistoryId = handled.historyId
      }
    }

    if (page >= Number(pagination.pageCount || 1)) break
    page += 1
  }

  const result = {
    imported: totalImported,
    eventsInserted: totalEventsInserted,
    filmsCreated: totalFilmsCreated,
    lastSyncedAt: latestWatchedAt,
    lastHistoryId: latestHistoryId,
    pagesProcessed: page,
    since
  }

  await saveSyncState(sql, {
    lastSyncedAt: latestWatchedAt,
    lastHistoryId: latestHistoryId,
    lastJobId: job?.id || null,
    lastResult: result
  })

  return result
}

async function ingestHistoryRow ({ event, sql, row }) {
  const historyId = toInt(row?.id)
  const watchedAt = row?.watched_at || null
  const movie = row?.movie || {}
  const ids = movie.ids || {}
  const traktId = toInt(ids.trakt)
  const tmdbId = toInt(ids.tmdb)

  if (!historyId || !traktId || !watchedAt) {
    return { eventInserted: false, created: false, historyId, watchedAt }
  }

  const [existingEvent] = await sql.query(
    'select id from film_watch_events where trakt_history_id = $1 limit 1',
    [historyId]
  )
  if (existingEvent) {
    return { eventInserted: false, created: false, historyId, watchedAt }
  }

  let film = null
  let created = false

  if (tmdbId) {
    const [existingByTmdb] = await sql.query('select * from films where tmdb_id = $1 limit 1', [tmdbId])
    if (existingByTmdb) {
      film = existingByTmdb
    } else {
      const tmdbToken = process.env.TMDB_API_ACCESS_TOKEN || ''
      if (tmdbToken) {
        const tmdbMovie = await fetchTmdbMovie(tmdbId, tmdbToken)
        if (tmdbMovie) {
          const upserted = await upsertFilmFromTmdb(sql, tmdbMovie)
          film = upserted.film
          created = upserted.created
          if (!film.poster_thumb_blob_key || !film.poster_cover_blob_key) {
            await cacheFilmPosters({ event, sql, film, tmdbMovie, force: false })
            const [cachedFilm] = await sql.query('select * from films where id = $1 limit 1', [film.id])
            film = cachedFilm || film
          }
        }
      }
    }
  }

  if (!film) {
    const [existingByTrakt] = await sql.query('select * from films where trakt_id = $1 limit 1', [traktId])
    if (existingByTrakt) {
      film = existingByTrakt
    }
  }

  if (!film) {
    const inserted = await sql.query(
      `insert into films (
        trakt_id,
        tmdb_id,
        imdb_id,
        trakt_slug,
        title,
        year,
        overview,
        created_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, '', now(), now()
      ) returning *`,
      [
        traktId,
        tmdbId,
        ids.imdb || null,
        ids.slug || null,
        movie.title || 'Untitled',
        toInt(movie.year)
      ]
    )
    film = inserted[0]
    created = true
  }

  await sql.query(
    `update films
     set
      trakt_id = case
        when exists(select 1 from films f2 where f2.trakt_id = $1 and f2.id <> $6) then films.trakt_id
        else $1
      end,
      tmdb_id = coalesce($2, tmdb_id),
      imdb_id = coalesce($3, imdb_id),
      trakt_slug = coalesce($4, trakt_slug),
      plays = coalesce(plays, 0) + 1,
      last_watched_at = case
        when last_watched_at is null then $5::timestamptz
        when $5::timestamptz > last_watched_at then $5::timestamptz
        else last_watched_at
      end,
      updated_at = now()
     where id = $6`,
    [
      traktId,
      tmdbId,
      ids.imdb || null,
      ids.slug || null,
      watchedAt,
      film.id
    ]
  )

  await sql.query(
    `insert into film_watch_events (
      film_id,
      trakt_history_id,
      watched_at,
      action,
      source,
      created_at
    ) values (
      $1, $2, $3, $4, 'trakt_api', now()
    )
    on conflict (trakt_history_id) do nothing`,
    [film.id, historyId, watchedAt, row?.action || null]
  )

  return { eventInserted: true, created, historyId, watchedAt }
}

function toInt (value) {
  const n = Number.parseInt(String(value), 10)
  return Number.isNaN(n) ? null : n
}

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
