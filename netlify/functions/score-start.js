const { isAuthorized } = require('./_score-auth')
const { startTournament } = require('./_score-core')
const { isRateLimited, getClientIp } = require('./_rate-limit')
const { requireWriteIntent } = require('./_write-guard')

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed.' })
    }
    const invalidWrite = requireWriteIntent(event)
    if (invalidWrite) return invalidWrite
    if (!isAuthorized(event)) {
      return jsonResponse(401, { error: 'Unauthorized.' })
    }

    const rate = isRateLimited({
      key: `score-start:${getClientIp(event)}`,
      limit: 20,
      windowMs: 60_000
    })
    if (rate.limited) {
      return jsonResponse(429, { error: 'Too many requests. Try again in a minute.' })
    }

    const body = JSON.parse(event.body || '{}')
    const pairing = typeof body.pairing === 'string' ? body.pairing : 'swiss'
    const band = typeof body.band === 'string' ? body.band : 'normal'
    const range = typeof body.range === 'string' ? body.range : 'random'
    const rdProfile = typeof body.rdProfile === 'string' ? body.rdProfile : 'balanced'
    const poolGoal = typeof body.poolGoal === 'string' ? body.poolGoal : 'hybrid'
    const freshnessBias = typeof body.freshnessBias === 'string' ? body.freshnessBias : 'mild'
    const minUncertaintyShare = typeof body.minUncertaintyShare === 'string' ? body.minUncertaintyShare : 'quarter'
    const matchBudget = typeof body.matchBudget === 'string' ? body.matchBudget : 'standard'
    const upsetFocus = typeof body.upsetFocus === 'string' ? body.upsetFocus : 'off'

    const state = await startTournament({
      pairing,
      band,
      range,
      rdProfile,
      poolGoal,
      freshnessBias,
      minUncertaintyShare,
      matchBudget,
      upsetFocus
    })
    return jsonResponse(200, state)
  } catch (error) {
    console.error('score-start failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to start tournament.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  }
}
