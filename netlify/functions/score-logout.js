const { clearAuthCookie } = require('./_score-auth')
const { requireWriteIntent } = require('./_write-guard')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Method not allowed.' })
    }
  }
  const invalidWrite = requireWriteIntent(event)
  if (invalidWrite) return invalidWrite

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'set-cookie': clearAuthCookie()
    },
    body: JSON.stringify({ ok: true })
  }
}
