const { requireAdmin } = require('./_admin-guard')
const { buildAuthorizeUrl, getTraktConfig } = require('./_trakt-core')
const { createStateCookie } = require('./_trakt-oauth-state')
const { reportError } = require('./_alerts')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  try {
    const config = getTraktConfig()
    const { state, cookie } = createStateCookie()
    const authorizeUrl = buildAuthorizeUrl({ state })

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': cookie
      },
      body: JSON.stringify({
        authorizeUrl,
        redirectUri: config.redirectUri
      })
    }
  } catch (error) {
    await reportError({ source: 'admin-trakt-auth-begin', error })
    return jsonResponse(500, { error: 'Failed to begin Trakt OAuth.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
