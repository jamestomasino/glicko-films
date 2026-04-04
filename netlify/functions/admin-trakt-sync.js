const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { enqueueJob, processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  try {
    const body = JSON.parse(event.body || '{}')
    const runNow = body.runNow !== false
    const payload = {
      since: typeof body.since === 'string' ? body.since : null,
      maxPages: Number.isFinite(Number(body.maxPages)) ? Number(body.maxPages) : undefined,
      perPage: Number.isFinite(Number(body.perPage)) ? Number(body.perPage) : undefined
    }

    const sql = neon()
    const job = await enqueueJob(sql, { type: 'trakt_sync', payload })

    let processed = []
    if (runNow) {
      processed = await processQueuedJobs(sql, {
        limit: 1,
        handlers: {
          trakt_sync: ({ job, payload }) => runTraktSyncJob({ event, sql, job, payload })
        }
      })
    }

    return jsonResponse(200, {
      enqueued: true,
      job,
      processed
    })
  } catch (error) {
    await reportError({ source: 'admin-trakt-sync', error })
    return jsonResponse(500, { error: 'Failed to start Trakt sync.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
