const { buildAuthCookie } = require('./_score-auth')
const { isRateLimited, getClientIp } = require('./_rate-limit')

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' })
    }
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
  } catch (error) {
    console.error('score-login failed', { message: error.message })
    return jsonResponse(500, { error: 'Login failed.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  }
}
