const { neon } = require('@netlify/neon')
const { requireAdmin } = require('./_admin-guard')
const { fetchAuthState, fetchSyncState, tokenExpiryAtIso, getTraktConfig } = require('./_trakt-core')
const { reportError } = require('./_alerts')
const { noStoreJsonResponse, withErrorHandling } = require('./_http')

exports.handler = withErrorHandling(async (event) => {
  const denied = requireAdmin(event, { method: 'GET', limit: 60, windowMs: 60_000 })
  if (denied) return denied

  const config = getTraktConfig()
  const sql = neon()
  const [state, syncState, [pendingJobs]] = await Promise.all([
    fetchAuthState(sql),
    fetchSyncState(sql),
    sql.query(`select count(*)::int as c from admin_jobs where status = 'queued'`)
  ])
  const expiresAt = tokenExpiryAtIso(state)

  return noStoreJsonResponse(200, {
    connected: Boolean(state?.access_token),
    hasRefreshToken: Boolean(state?.refresh_token),
    tokenType: state?.token_type || null,
    scope: state?.scope || null,
    connectedAt: state?.connected_at || null,
    expiresAt,
    redirectUri: config.redirectUri,
    sync: {
      lastSyncedAt: syncState?.last_synced_at || null,
      lastHistoryId: syncState?.last_history_id ? Number(syncState.last_history_id) : null,
      lastRunAt: syncState?.last_run_at || null,
      lastResult: syncState?.last_result || null,
      pendingJobs: Number(pendingJobs?.c || 0)
    }
  })
}, {
  source: 'admin-trakt-status',
  message: 'Failed to load Trakt status.',
  noStore: true,
  onError: async (error) => {
    await reportError({ source: 'admin-trakt-status', error })
  }
})
