const baseURL = process.env.SMOKE_BASE_URL || 'http://localhost:8888'

const checks = [
  {
    name: 'films',
    path: '/api/films?limit=1&offset=0',
    validate: async (res, data) => {
      if (!Array.isArray(data.items)) throw new Error('films payload missing items[]')
      if (typeof data.total !== 'number') throw new Error('films payload missing total')
      if (!res.ok) throw new Error(`films failed: HTTP ${res.status}`)
    }
  },
  {
    name: 'images validation',
    path: '/api/images',
    validate: async (res) => {
      if (res.status !== 400) throw new Error(`images expected 400 without key, got ${res.status}`)
    }
  },
  {
    name: 'score session',
    path: '/api/score/session',
    validate: async (res, data) => {
      if (!res.ok) throw new Error(`score session failed: HTTP ${res.status}`)
      if (typeof data.authenticated !== 'boolean') {
        throw new Error('score session missing authenticated boolean')
      }
    }
  }
]

for (const check of checks) {
  const url = `${baseURL}${check.path}`
  const res = await fetch(url)
  let data = null
  const type = res.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    data = await res.json()
  }
  await check.validate(res, data)
  console.log(`ok: ${check.name}`)
}

console.log('API smoke checks passed.')
