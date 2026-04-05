const { isAuthorized } = require('./_score-auth')
const { submitScore } = require('./_score-core')
const { isRateLimited, getClientIp } = require('./_rate-limit')
const { requireWriteIntent } = require('./_write-guard')
const { jsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }
  const invalidWrite = requireWriteIntent(event)
  if (invalidWrite) return invalidWrite
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
}, { source: 'score-submit', message: 'Failed to submit score.' })
