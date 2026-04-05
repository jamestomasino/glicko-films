const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { getRecentJobs } = require('./_jobs-core')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  const sql = neon()
  const limit = Number.parseInt(String(event.queryStringParameters?.limit || '20'), 10)
  const jobs = await getRecentJobs(sql, limit)
  return noStoreJsonResponse(200, { jobs })
}, { source: 'admin-jobs', message: 'Failed to load jobs.', noStore: true })
