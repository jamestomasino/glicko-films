const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { pollDeviceToken, saveAuthState, tokenExpiryAtIso } = require('./_trakt-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 120, windowMs: 60_000 })
  if (denied) return denied

  try {
    const body = JSON.parse(event.body || '{}')
    const code = String(body.deviceCode || '').trim()
    if (!code) {
      return jsonResponse(400, { error: 'deviceCode is required.' })
    }

    const polled = await pollDeviceToken(code)
    if (polled.pending) {
      return jsonResponse(200, { pending: true })
    }

    const sql = neon()
    const state = await saveAuthState(sql, polled.token)

    return jsonResponse(200, {
      pending: false,
      connected: true,
      connectedAt: state.connected_at || null,
      expiresAt: tokenExpiryAtIso(state)
    })
  } catch (error) {
    console.error('admin-trakt-auth-poll failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to poll Trakt auth.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
