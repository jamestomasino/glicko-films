const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { exchangeAuthorizationCode, saveAuthState, tokenExpiryAtIso } = require('./_trakt-core')
const { clearStateCookie, readStateCookie } = require('./_trakt-oauth-state')
const { reportError } = require('./_alerts')
const { withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  const body = JSON.parse(event.body || '{}')
  const code = String(body.code || '').trim()
  const state = String(body.state || '').trim()

  if (!code) {
    return response(400, { error: 'code is required.' }, clearStateCookie())
  }

  const expectedState = readStateCookie(event)
  if (!expectedState || !state || expectedState !== state) {
    return response(400, { error: 'Invalid OAuth state.' }, clearStateCookie())
  }

  const token = await exchangeAuthorizationCode(code)
  const sql = neon()
  const authState = await saveAuthState(sql, token)

  return response(200, {
    connected: true,
    connectedAt: authState.connected_at || null,
    expiresAt: tokenExpiryAtIso(authState)
  }, clearStateCookie())
}, {
  source: 'admin-trakt-auth-callback',
  message: 'Failed to complete Trakt OAuth callback.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-auth-callback', error })
  }
})

function response (statusCode, body, cookie) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
  if (cookie) headers['set-cookie'] = cookie
  return {
    statusCode,
    headers,
    body: JSON.stringify(body)
  }
}
