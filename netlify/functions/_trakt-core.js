const TRAKT_API_BASE_URL = 'https://api.trakt.tv'

module.exports = {
  TRAKT_API_BASE_URL,
  getTraktConfig,
  buildAuthorizeUrl,
  requestDeviceCode,
  pollDeviceToken,
  exchangeAuthorizationCode,
  ensureAccessToken,
  traktAuthedGet,
  fetchAuthState,
  saveAuthState,
  fetchSyncState,
  saveSyncState,
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

function traktHeaders ({ includeContentType = true } = {}) {
  const { clientId } = getTraktConfig()
  const headers = {
    accept: 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    'user-agent': process.env.TRAKT_HTTP_USER_AGENT || 'films.tomasino.org (+https://films.tomasino.org)'
  }
  if (includeContentType) headers['content-type'] = 'application/json'
  return headers
}

async function requestDeviceCode () {
  const { clientId } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/device/code`, {
    method: 'POST',
    headers: traktHeaders(),
    body: JSON.stringify({ client_id: clientId })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Device code request failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
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
    headers: traktHeaders(),
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
    const detail = await response.text().catch(() => '')
    throw new Error(`Device token request failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
  }

  const token = await response.json()
  return { pending: false, token }
}

async function exchangeAuthorizationCode (code) {
  const { clientId, clientSecret, redirectUri } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: traktHeaders(),
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
    throw new Error(`OAuth code exchange failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
  }

  return response.json()
}

async function ensureAccessToken (sql) {
  const state = await fetchAuthState(sql)
  if (!state?.access_token) {
    throw new Error('Trakt is not connected yet.')
  }

  const now = Math.floor(Date.now() / 1000)
  const createdAt = Number(state.created_at_epoch || 0)
  const expiresIn = Number(state.expires_in || 0)
  const expiresAt = createdAt + expiresIn
  const tokenIsFresh = createdAt > 0 && expiresIn > 0 && expiresAt > (now + 60)

  if (tokenIsFresh) {
    return state.access_token
  }

  if (!state.refresh_token) {
    throw new Error('Trakt refresh token is missing. Reconnect Trakt.')
  }

  const refreshed = await refreshAccessToken(state.refresh_token)
  const saved = await saveAuthState(sql, refreshed)
  return saved.access_token
}

async function traktAuthedGet (sql, path, params = {}) {
  const accessToken = await ensureAccessToken(sql)
  const url = new URL(`${TRAKT_API_BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    url.searchParams.set(key, String(value))
  })

  const { clientId } = getTraktConfig()
  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'user-agent': process.env.TRAKT_HTTP_USER_AGENT || 'films.tomasino.org (+https://films.tomasino.org)'
    }
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Trakt request failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
  }

  const data = await response.json()
  return {
    data,
    pagination: {
      page: Number(response.headers.get('x-pagination-page') || 1),
      limit: Number(response.headers.get('x-pagination-limit') || 0),
      pageCount: Number(response.headers.get('x-pagination-page-count') || 1),
      itemCount: Number(response.headers.get('x-pagination-item-count') || 0)
    }
  }
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

async function fetchSyncState (sql) {
  const [row] = await sql.query(
    `select
      key,
      last_synced_at,
      last_history_id,
      last_job_id,
      last_run_at,
      last_result,
      updated_at
     from trakt_sync_state
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

async function saveSyncState (sql, state) {
  await sql.query(
    `insert into trakt_sync_state (
      key,
      last_synced_at,
      last_history_id,
      last_job_id,
      last_run_at,
      last_result,
      updated_at
    ) values (
      'primary', $1, $2, $3, now(), $4::jsonb, now()
    )
    on conflict (key) do update
    set
      last_synced_at = excluded.last_synced_at,
      last_history_id = excluded.last_history_id,
      last_job_id = excluded.last_job_id,
      last_run_at = now(),
      last_result = excluded.last_result,
      updated_at = now()`,
    [
      state.lastSyncedAt || null,
      state.lastHistoryId || null,
      state.lastJobId || null,
      JSON.stringify(state.lastResult || {})
    ]
  )
  return fetchSyncState(sql)
}

function tokenExpiryAtIso (state) {
  if (!state?.created_at_epoch || !state?.expires_in) return null
  const expiry = (Number(state.created_at_epoch) + Number(state.expires_in)) * 1000
  if (!Number.isFinite(expiry)) return null
  return new Date(expiry).toISOString()
}

async function refreshAccessToken (refreshToken) {
  const { clientId, clientSecret, redirectUri } = getTraktConfig()
  const response = await fetch(`${TRAKT_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: traktHeaders(),
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Trakt refresh failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ''}`)
  }
  return response.json()
}
