const { neon } = require('@netlify/neon')
const { processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')

exports.config = {
  schedule: '*/5 * * * *'
}

exports.handler = async (event) => {
  try {
    const sql = neon()
    const limit = clampInt(process.env.JOB_SCHEDULED_BATCH_LIMIT, 3, 1, 20)

    const processed = await processQueuedJobs(sql, {
      limit,
      handlers: {
        trakt_sync: ({ job, payload }) => runTraktSyncJob({ event, sql, job, payload })
      }
    })

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        ok: true,
        processedCount: processed.length,
        processed
      })
    }
  } catch (error) {
    await reportError({ source: 'jobs-scheduled', error })
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ ok: false, error: error.message })
    }
  }
}

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
