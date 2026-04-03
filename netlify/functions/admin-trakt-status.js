const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { fetchAuthState, tokenExpiryAtIso, getTraktConfig } = require('./_trakt-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  try {
    const config = getTraktConfig()
    const sql = neon()
    const state = await fetchAuthState(sql)
    const expiresAt = tokenExpiryAtIso(state)

    return jsonResponse(200, {
      connected: Boolean(state?.access_token),
      hasRefreshToken: Boolean(state?.refresh_token),
      tokenType: state?.token_type || null,
      scope: state?.scope || null,
      connectedAt: state?.connected_at || null,
      expiresAt,
      redirectUri: config.redirectUri
    })
  } catch (error) {
    console.error('admin-trakt-status failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to load Trakt status.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
