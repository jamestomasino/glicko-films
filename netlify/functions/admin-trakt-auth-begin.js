const { requireAdmin } = require('./_admin-guard')
const { buildAuthorizeUrl, getTraktConfig } = require('./_trakt-core')
const { createStateCookie } = require('./_trakt-oauth-state')
const { reportError } = require('./_alerts')
const { withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

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
}, {
  source: 'admin-trakt-auth-begin',
  message: 'Failed to begin Trakt OAuth.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-auth-begin', error })
  }
})
