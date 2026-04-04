const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  try {
    const body = JSON.parse(event.body || '{}')
    const limit = Math.max(1, Math.min(10, Number.parseInt(String(body.limit || '1'), 10) || 1))

    const sql = neon()
    const processed = await processQueuedJobs(sql, {
      limit,
      handlers: {
        trakt_sync: ({ job, payload }) => runTraktSyncJob({ event, sql, job, payload })
      }
    })

    return jsonResponse(200, {
      processedCount: processed.length,
      processed
    })
  } catch (error) {
    await reportError({ source: 'admin-jobs-run', error })
    return jsonResponse(500, { error: 'Failed to run jobs.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
