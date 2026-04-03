const buckets = new Map()

module.exports = {
  isRateLimited,
  getClientIp
}

function isRateLimited ({ key, limit, windowMs }) {
  const now = Date.now()
  const state = buckets.get(key)

  if (!state || now >= state.resetAt) {
    const next = { count: 1, resetAt: now + windowMs }
    buckets.set(key, next)
    return { limited: false, remaining: limit - 1, resetAt: next.resetAt }
  }

  state.count += 1
  if (state.count > limit) {
    return { limited: true, remaining: 0, resetAt: state.resetAt }
  }

  return { limited: false, remaining: limit - state.count, resetAt: state.resetAt }
}

function getClientIp (event) {
  const headers = event?.headers || {}
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'] || 'unknown'
}
