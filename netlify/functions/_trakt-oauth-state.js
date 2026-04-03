const crypto = require('node:crypto')

const COOKIE_NAME = '__Host-trakt_oauth_state'
const MAX_AGE_SECONDS = 60 * 10

module.exports = {
  COOKIE_NAME,
  createStateCookie,
  clearStateCookie,
  readStateCookie
}

function createStateCookie () {
  const secret = getStateSecret()
  if (!secret) throw new Error('Missing TRAKT OAuth state secret.')

  const payload = {
    nonce: crypto.randomBytes(24).toString('base64url'),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = sign(encodedPayload, secret)
  const token = `${encodedPayload}.${signature}`

  return {
    state: payload.nonce,
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
  }
}

function readStateCookie (event) {
  const secret = getStateSecret()
  if (!secret) return null

  const cookieHeader = event?.headers?.cookie || event?.headers?.Cookie || ''
  const cookies = parseCookies(cookieHeader)
  const token = cookies[COOKIE_NAME]
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expected = sign(encodedPayload, secret)
  if (!timingSafeEqual(signature, expected)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (!payload?.exp || !payload?.nonce) return null
  if (Math.floor(Date.now() / 1000) >= Number(payload.exp)) return null

  return payload.nonce
}

function clearStateCookie () {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
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

function getStateSecret () {
  return process.env.TRAKT_OAUTH_STATE_SECRET || process.env.SCORE_SESSION_SECRET || process.env.SCORE_PASSWORD || ''
}
