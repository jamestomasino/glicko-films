const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { enqueueJob, processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

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

  return noStoreJsonResponse(200, {
    enqueued: true,
    job,
    processed
  })
}, {
  source: 'admin-trakt-sync',
  message: 'Failed to start Trakt sync.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-sync', error })
  }
})
