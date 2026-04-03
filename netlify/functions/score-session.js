const { isAuthorized } = require('./_score-auth')

exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ authenticated: isAuthorized(event) })
  }
}
