const { requireAdmin } = require('./_admin-guard')
const { requestDeviceCode, getTraktConfig } = require('./_trakt-core')

exports.handler = async (event) => {
  const denied = requireAdmin(event, { method: 'POST', limit: 20, windowMs: 60_000 })
  if (denied) return denied

  try {
    const config = getTraktConfig()
    const payload = await requestDeviceCode()

    return jsonResponse(200, {
      deviceCode: payload.device_code,
      userCode: payload.user_code,
      verificationUrl: payload.verification_url,
      verificationUrlComplete: `${payload.verification_url}/${payload.user_code}`,
      expiresIn: Number(payload.expires_in) || 0,
      interval: Number(payload.interval) || 5,
      redirectUri: config.redirectUri
    })
  } catch (error) {
    console.error('admin-trakt-auth-start failed', { message: error.message })
    return jsonResponse(500, { error: 'Failed to start Trakt auth.', detail: error.message })
  }
}

function jsonResponse (statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
