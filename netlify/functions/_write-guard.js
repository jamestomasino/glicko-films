module.exports = {
  requireWriteIntent,
  writeGuardHeaders
}

function requireWriteIntent (event) {
  const header = event?.headers?.['x-film-write-intent'] || event?.headers?.['X-Film-Write-Intent']
  if (header === '1') return null

  return {
    statusCode: 403,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...writeGuardHeaders()
    },
    body: JSON.stringify({ error: 'Forbidden write request.' })
  }
}

function writeGuardHeaders () {
  return {
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin'
  }
}
