const { isAuthorized } = require('./_score-auth')
const { getScoreState } = require('./_score-core')
const { jsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  if (!isAuthorized(event)) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }
  const state = await getScoreState()
  return jsonResponse(200, state)
}, { source: 'score-state', message: 'Failed to load score state.' })
