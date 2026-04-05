const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  const body = JSON.parse(event.body || '{}')
  const limit = Math.max(1, Math.min(10, Number.parseInt(String(body.limit || '1'), 10) || 1))

  const sql = neon()
  const processed = await processQueuedJobs(sql, {
    limit,
    handlers: {
      trakt_sync: ({ job, payload }) => runTraktSyncJob({ event, sql, job, payload })
    }
  })

  return noStoreJsonResponse(200, {
    processedCount: processed.length,
    processed
  })
}, {
  source: 'admin-jobs-run',
  message: 'Failed to run jobs.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-jobs-run', error })
  }
})
