const crypto = require('node:crypto')

const COOKIE_NAME = '__Host-score_auth'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

module.exports = {
  COOKIE_NAME,
  buildAuthCookie,
  clearAuthCookie,
  isAuthorized
}

function isAuthorized (event) {
  const secret = getSessionSecret()
  if (!secret) return false

  const cookieHeader = event?.headers?.cookie || event?.headers?.Cookie || ''
  const cookies = parseCookies(cookieHeader)
  const token = cookies[COOKIE_NAME]
  if (!token) return false

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return false

  const expectedSignature = sign(encodedPayload, secret)
  if (!timingSafeEqual(signature, expectedSignature)) return false

  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return false
  }

  if (!payload?.exp || typeof payload.exp !== 'number') return false
  return Math.floor(Date.now() / 1000) < payload.exp
}

function buildAuthCookie (passwordAttempt) {
  const password = process.env.SCORE_PASSWORD
  if (!password || passwordAttempt !== password) return null
  const secret = getSessionSecret()
  if (!secret) return null

  const payload = {
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = sign(encodedPayload, secret)
  const token = `${encodedPayload}.${signature}`

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`
}

function clearAuthCookie () {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function sign (value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function timingSafeEqual (a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function parseCookies (cookieHeader) {
  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, chunk) => {
      const idx = chunk.indexOf('=')
      if (idx === -1) return acc
      const key = chunk.slice(0, idx)
      const value = chunk.slice(idx + 1)
      acc[key] = value
      return acc
    }, {})
}

function getSessionSecret () {
  return process.env.SCORE_SESSION_SECRET || process.env.SCORE_PASSWORD || ''
}
