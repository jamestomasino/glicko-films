const { requireAdmin } = require('./_admin-guard')
const { requestDeviceCode, getTraktConfig } = require('./_trakt-core')
const { reportError } = require('./_alerts')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  const config = getTraktConfig()
  const payload = await requestDeviceCode()

  return noStoreJsonResponse(200, {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUrl: payload.verification_url,
    verificationUrlComplete: `${payload.verification_url}/${payload.user_code}`,
    expiresIn: Number(payload.expires_in) || 0,
    interval: Number(payload.interval) || 5,
    redirectUri: config.redirectUri
  })
}, {
  source: 'admin-trakt-auth-start',
  message: 'Failed to start Trakt auth.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-auth-start', error })
  }
})
