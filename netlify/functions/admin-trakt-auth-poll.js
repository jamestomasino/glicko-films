const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { pollDeviceToken, saveAuthState, tokenExpiryAtIso } = require('./_trakt-core')
const { reportError } = require('./_alerts')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 120, windowMs: 60_000 })
  if (denied) return denied

  const body = JSON.parse(event.body || '{}')
  const code = String(body.deviceCode || '').trim()
  if (!code) {
    return noStoreJsonResponse(400, { error: 'deviceCode is required.' })
  }

  const polled = await pollDeviceToken(code)
  if (polled.pending) {
    return noStoreJsonResponse(200, { pending: true })
  }

  const sql = neon()
  const state = await saveAuthState(sql, polled.token)

  return noStoreJsonResponse(200, {
    pending: false,
    connected: true,
    connectedAt: state.connected_at || null,
    expiresAt: tokenExpiryAtIso(state)
  })
}, {
  source: 'admin-trakt-auth-poll',
  message: 'Failed to poll Trakt auth.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-auth-poll', error })
  }
})
