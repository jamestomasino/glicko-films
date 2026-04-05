const { neon } = require('@netlify/neon')
const { processQueuedJobs } = require('./_jobs-core')
const { runTraktSyncJob } = require('./_trakt-sync-worker')
const { reportError } = require('./_alerts')
const { jsonResponse, withErrorHandling } = require('./_http')

exports.config = {
  schedule: '*/5 * * * *'
}

exports.handler = withErrorHandling(async (event) => {
  const authError = validateScheduleAuth(event)
  if (authError) return authError

  const sql = neon()
  const limit = clampInt(process.env.JOB_SCHEDULED_BATCH_LIMIT, 3, 1, 20)

  const processed = await processQueuedJobs(sql, {
    limit,
    handlers: {
      trakt_sync: ({ job, payload }) => runTraktSyncJob({ event, sql, job, payload })
    }
  })

  return jsonResponse(200, {
    ok: true,
    processedCount: processed.length,
    processed
  })
}, {
  source: 'jobs-scheduled',
  message: 'Failed to run scheduled jobs.',
  onError: async (error) => {
    await reportError({ source: 'jobs-scheduled', error })
  }
})

function clampInt (value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function validateScheduleAuth (event) {
  const secret = String(process.env.JOB_SCHEDULED_SECRET || '').trim()
  if (!secret) {
    return jsonResponse(500, { ok: false, error: 'JOB_SCHEDULED_SECRET is not configured.' })
  }

  const headers = event?.headers || {}
  const headerSecret = headers['x-job-scheduled-secret'] || headers['X-Job-Scheduled-Secret'] || ''
  const auth = headers.authorization || headers.Authorization || ''
  const bearerSecret = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  const supplied = String(headerSecret || bearerSecret || '').trim()

  if (supplied !== secret) {
    return jsonResponse(401, { ok: false, error: 'Unauthorized.' })
  }

  return null
}
