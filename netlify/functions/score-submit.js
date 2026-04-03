const { isAuthorized } = require('./_score-auth')
const { submitScore } = require('./_score-core')
const { isRateLimited, getClientIp } = require('./_rate-limit')

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' })
    }
    if (!isAuthorized(event)) {
      return jsonResponse(401, { error: 'Unauthorized.' })
    }
    const rate = isRateLimited({
      key: `score-submit:${getClientIp(event)}`,
      limit: 180,
      windowMs: 60_000
    })
    if (rate.limited) {
      return jsonResponse(429, { error: 'Too many submissions. Slow down a bit.' })
    }

    const body = JSON.parse(event.body || '{}')
    const matchId = Number(body.matchId)
    const tournamentId = Number(body.tournamentId)
    const outcome = body.outcome

    if (!Number.isInteger(matchId) || !Number.isInteger(tournamentId)) {
      return jsonResponse(400, { error: 'Invalid match payload.' })
    }

    const nextState = await submitScore({ matchId, tournamentId, outcome })
    return jsonResponse(200, nextState)
  } catch (error) {
    console.error('score-submit failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to submit score.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  }
}
