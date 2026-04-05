const { buildAuthCookie } = require('./_score-auth')
const { isRateLimited, getClientIp } = require('./_rate-limit')
const { requireWriteIntent } = require('./_write-guard')
const { jsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }
  if (!process.env.SCORE_SESSION_SECRET) {
    return jsonResponse(500, { error: 'SCORE_SESSION_SECRET is not configured.' })
  }
  const invalidWrite = requireWriteIntent(event)
  if (invalidWrite) return invalidWrite
  const rate = isRateLimited({
    key: `score-login:${getClientIp(event)}`,
    limit: 10,
    windowMs: 60_000
  })
  if (rate.limited) {
    return jsonResponse(429, { error: 'Too many login attempts. Try again in a minute.' })
  }

  const payload = JSON.parse(event.body || '{}')
  const password = payload.password || ''
  const cookie = buildAuthCookie(password)
  if (!cookie) {
    console.warn('score-login invalid password attempt')
    return jsonResponse(401, { error: 'Invalid password.' })
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': cookie
    },
    body: JSON.stringify({ ok: true })
  }
}, { source: 'score-login', message: 'Login failed.' })
