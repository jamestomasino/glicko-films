const { isAuthorized } = require('./_score-auth')
const { getScoreState } = require('./_score-core')

exports.handler = async (event) => {
  try {
    if (!isAuthorized(event)) {
      return jsonResponse(401, { error: 'Unauthorized.' })
    }

    const state = await getScoreState()
    return jsonResponse(200, state)
  } catch (error) {
    return jsonResponse(500, { error: 'Failed to load score state.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  }
}
