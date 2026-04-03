const { clearAuthCookie } = require('./_score-auth')

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': clearAuthCookie()
    },
    body: JSON.stringify({ ok: true })
  }
}
