const { buildAuthCookie } = require('./_score-auth')

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' })
    }

    const payload = JSON.parse(event.body || '{}')
    const password = payload.password || ''
    const cookie = buildAuthCookie(password)
    if (!cookie) {
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
