const { isAuthorized } = require('./_score-auth')
const { isRateLimited, getClientIp } = require('./_rate-limit')
const { requireWriteIntent } = require('./_write-guard')

module.exports = {
  requireAdmin
}

function requireAdmin (event, { method = 'GET', limit = 30, windowMs = 60_000 } = {}) {
  if (event.httpMethod !== method) {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }
  if (method !== 'GET') {
    const invalidWrite = requireWriteIntent(event)
    if (invalidWrite) return invalidWrite
  }

  if (!isAuthorized(event)) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }

  const ip = getClientIp(event)
  const path = event.path || 'admin'
  const rate = isRateLimited({ key: `admin:${path}:${ip}`, limit, windowMs })
  if (rate.limited) {
    return jsonResponse(429, { error: 'Too many requests. Try again in a minute.' })
  }

  return null
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  }
}
