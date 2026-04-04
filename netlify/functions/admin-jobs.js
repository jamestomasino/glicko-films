const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { getRecentJobs } = require('./_jobs-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  try {
    const sql = neon()
    const limit = Number.parseInt(String(event.queryStringParameters?.limit || '20'), 10)
    const jobs = await getRecentJobs(sql, limit)
    return jsonResponse(200, { jobs })
  } catch (error) {
    return jsonResponse(500, { error: 'Failed to load jobs.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
