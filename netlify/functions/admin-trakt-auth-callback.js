const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { exchangeAuthorizationCode, saveAuthState, tokenExpiryAtIso } = require('./_trakt-core')
const { clearStateCookie, readStateCookie } = require('./_trakt-oauth-state')
const { reportError } = require('./_alerts')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 30, windowMs: 60_000 })
  if (denied) return denied

  try {
    const body = JSON.parse(event.body || '{}')
    const code = String(body.code || '').trim()
    const state = String(body.state || '').trim()

    if (!code) {
      return response(400, { error: 'code is required.' }, clearStateCookie())
    }

    const expectedState = readStateCookie(event)
    if (expectedState && state && expectedState !== state) {
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
  } catch (error) {
    await reportError({ source: 'admin-trakt-auth-callback', error })
    return response(500, { error: 'Failed to complete Trakt OAuth callback.', detail: error.message }, clearStateCookie())
  }
}

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
