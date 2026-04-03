const TRAKT_API_BASE_URL = 'https://api.trakt.tv'

module.exports = {
  TRAKT_API_BASE_URL,
  getTraktConfig,
  buildAuthorizeUrl,
  requestDeviceCode,
  pollDeviceToken,
  exchangeAuthorizationCode,
  fetchAuthState,
  saveAuthState,
  tokenExpiryAtIso
}

function getTraktConfig () {
  const clientId = process.env.TRAKT_CLIENT_ID || ''
  const clientSecret = process.env.TRAKT_CLIENT_SECRET || ''
  const redirectUri = process.env.TRAKT_REDIRECT_URI || 'https://films.tomasino.org/admin/trakt/callback'

  if (!clientId || !clientSecret) {
    throw new Error('TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET are required.')
  }

  return { clientId, clientSecret, redirectUri }
}

async function requestDeviceCode () {
  const { clientId } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/device/code`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    },
    body: JSON.stringify({ client_id: clientId })
  })

  if (!response.ok) {
    throw new Error(`Device code request failed (HTTP ${response.status})`)
  }

  return response.json()
}

function buildAuthorizeUrl ({ state } = {}) {
  const { clientId, redirectUri } = getTraktConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri
  })
  if (state) params.set('state', state)
  return `https://trakt.tv/oauth/authorize?${params.toString()}`
}

async function pollDeviceToken (code) {
  const { clientId, clientSecret } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/device/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (response.status === 400) {
    return { pending: true }
  }

  if (!response.ok) {
    throw new Error(`Device token request failed (HTTP ${response.status})`)
  }

  const token = await response.json()
  return { pending: false, token }
}

async function exchangeAuthorizationCode (code) {
  const { clientId, clientSecret, redirectUri } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId
    },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OAuth code exchange failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`)
  }

  return response.json()
}

async function fetchAuthState (sql) {
  const [row] = await sql.query(
    `select
      key,
      access_token,
      refresh_token,
      token_type,
      scope,
      created_at_epoch,
      expires_in,
      connected_at,
      updated_at
     from trakt_auth_state
     where key = 'primary'
     limit 1`
  )
  return row || null
}

async function saveAuthState (sql, token) {
  const createdAtEpoch = Number(token.created_at)
  const expiresIn = Number(token.expires_in)

  await sql.query(
    `insert into trakt_auth_state (
      key,
      access_token,
      refresh_token,
      token_type,
      scope,
      created_at_epoch,
      expires_in,
      connected_at,
      updated_at
    ) values (
      'primary', $1, $2, $3, $4, $5, $6, now(), now()
    )
    on conflict (key) do update
    set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_type = excluded.token_type,
      scope = excluded.scope,
      created_at_epoch = excluded.created_at_epoch,
      expires_in = excluded.expires_in,
      connected_at = now(),
      updated_at = now()`,
    [
      token.access_token,
      token.refresh_token,
      token.token_type || 'bearer',
      token.scope || '',
      Number.isFinite(createdAtEpoch) ? createdAtEpoch : Math.floor(Date.now() / 1000),
      Number.isFinite(expiresIn) ? expiresIn : 0
    ]
  )

  return fetchAuthState(sql)
}

function tokenExpiryAtIso (state) {
  if (!state?.created_at_epoch || !state?.expires_in) return null
  const expiry = (Number(state.created_at_epoch) + Number(state.expires_in)) * 1000
  if (!Number.isFinite(expiry)) return null
  return new Date(expiry).toISOString()
}
