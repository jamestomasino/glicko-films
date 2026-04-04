import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [health, setHealth] = useState(null)
  const [traktStatus, setTraktStatus] = useState(null)
  const [jobs, setJobs] = useState([])
  const [deviceAuth, setDeviceAuth] = useState({ deviceCode: '', userCode: '', verificationUrlComplete: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [tmdbIdInput, setTmdbIdInput] = useState('')
  const [filmIdInput, setFilmIdInput] = useState('')
  const [tmdbIdMaintInput, setTmdbIdMaintInput] = useState('')
  const [manualEloInput, setManualEloInput] = useState('')
  const [maintSearchQuery, setMaintSearchQuery] = useState('')
  const [maintSearchResults, setMaintSearchResults] = useState([])

  useEffect(() => {
    document.title = 'Admin · Tomasino Film Rankings'
    void checkSession()
  }, [])

  async function checkSession() {
    const response = await fetch('/api/score/session', { credentials: 'include' })
    if (!response.ok) return
    const payload = await response.json()
    const session = Boolean(payload.authenticated)
    setAuthenticated(session)
    if (session) {
      await loadHealth()
      await loadTraktStatus()
      await loadJobs()
    }
  }

  async function runAction(fn) {
    setLoading(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setSuccess('')
      setError(err.message || 'Request failed.')
    } finally {
      setLoading(false)
    }
  }

  async function login(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/score/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ password })
      })
      if (!response.ok) throw new Error('Invalid password.')
      setPassword('')
      setAuthenticated(true)
      window.dispatchEvent(new Event('score-auth-changed'))
      await loadHealth()
      await loadTraktStatus()
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetch('/api/score/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-film-write-intent': '1' }
    })
    setAuthenticated(false)
    setHealth(null)
    setTraktStatus(null)
    setJobs([])
    setDeviceAuth({ deviceCode: '', userCode: '', verificationUrlComplete: '' })
    setSearchResults([])
    setMaintSearchResults([])
    window.dispatchEvent(new Event('score-auth-changed'))
  }

  async function loadHealth() {
    await runAction(async () => {
      const response = await fetch('/api/admin/health', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to load admin health.')
      setHealth(await response.json())
      setSuccess(`Health refreshed at ${new Date().toLocaleTimeString()}`)
    })
  }

  async function loadTraktStatus() {
    await runAction(async () => {
      const response = await fetch('/api/admin/trakt-status', { credentials: 'include' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to load Trakt status.')
      setTraktStatus(payload)
    })
  }

  async function loadJobs() {
    await runAction(async () => {
      const response = await fetch('/api/admin/jobs?limit=20', { credentials: 'include' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to load jobs.')
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : [])
    })
  }

  async function startTraktDeviceAuth(event) {
    event.preventDefault()
    await runAction(async () => {
      const response = await fetch('/api/admin/trakt-auth-start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-film-write-intent': '1' }
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to start Trakt auth.')
      setDeviceAuth({
        deviceCode: payload.deviceCode,
        userCode: payload.userCode,
        verificationUrlComplete: payload.verificationUrlComplete
      })
      setSuccess(`Trakt code generated. Expires in ${payload.expiresIn}s.`)
    })
  }

  async function beginTraktOAuthRedirect() {
    await runAction(async () => {
      const response = await fetch('/api/admin/trakt-auth-begin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-film-write-intent': '1' }
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to begin redirect auth.')
      if (!payload.authorizeUrl) throw new Error('Missing authorize URL.')
      window.location.href = payload.authorizeUrl
    })
  }

  async function pollTraktDeviceAuth() {
    await runAction(async () => {
      const response = await fetch('/api/admin/trakt-auth-poll', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ deviceCode: deviceAuth.deviceCode })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to poll Trakt token.')
      if (payload.pending) {
        setSuccess('Still waiting for authorization. Complete Trakt verification and poll again.')
        return
      }
      setSuccess('Trakt connected successfully.')
      await loadTraktStatus()
    })
  }

  async function queueTraktSync(runNow = false) {
    await runAction(async () => {
      const response = await fetch('/api/admin/trakt-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ runNow })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to queue Trakt sync.')
      const processed = Array.isArray(payload.processed) ? payload.processed.length : 0
      setSuccess(runNow
        ? `Trakt sync queued and processed (${processed} job(s) run).`
        : `Trakt sync queued as job #${payload.job?.id || '?'}.`)
      await loadTraktStatus()
      await loadJobs()
    })
  }

  async function runQueuedJobs(limit = 1) {
    await runAction(async () => {
      const response = await fetch('/api/admin/jobs-run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ limit })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to run jobs.')
      setSuccess(`Ran ${payload.processedCount || 0} queued job(s).`)
      await loadTraktStatus()
      await loadJobs()
    })
  }

  async function searchTmdb(event) {
    event.preventDefault()
    await runAction(async () => {
      const q = searchQuery.trim()
      if (q.length < 2) throw new Error('Search query must be at least 2 characters.')
      const response = await fetch(`/api/admin/tmdb-search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      if (!response.ok) throw new Error('TMDb search failed.')
      const payload = await response.json()
      setSearchResults(payload.items || [])
      setSuccess(`Found ${(payload.items || []).length} result(s).`)
    })
  }

  async function addFilm(tmdbId) {
    await runAction(async () => {
      const response = await fetch('/api/admin/intake-add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ tmdbId: Number(tmdbId) })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Failed to add film.')
      setSuccess(payload.created
        ? `Added ${payload.film.title}. Images cached: ${payload.cached ? 'yes' : 'no'}.`
        : `Updated ${payload.film.title}. Images cached: ${payload.cached ? 'yes' : 'no'}.`)
      await loadHealth()
    })
  }

  async function addByTmdbId(event) {
    event.preventDefault()
    if (!tmdbIdInput) return
    await addFilm(tmdbIdInput)
  }

  async function reseed(resetGlicko) {
    await runAction(async () => {
      const response = await fetch('/api/admin/reseed', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({
          filmId: filmIdInput ? Number(filmIdInput) : null,
          tmdbId: tmdbIdMaintInput ? Number(tmdbIdMaintInput) : null,
          resetGlicko
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Reseed failed.')
      setSuccess(`Reseeded ${payload.film.title}${resetGlicko ? ' and reset Glicko' : ''}.`)
    })
  }

  async function recache(force) {
    await runAction(async () => {
      const response = await fetch('/api/admin/recache', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({
          filmId: filmIdInput ? Number(filmIdInput) : null,
          tmdbId: tmdbIdMaintInput ? Number(tmdbIdMaintInput) : null,
          force
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Recache failed.')
      setSuccess(payload.cached
        ? `Recached posters for ${payload.film.title}.`
        : `No recache performed for ${payload.film.title}: ${payload.reason || 'unchanged'}.`)
      await loadHealth()
    })
  }

  async function searchMaintenanceFilms(event) {
    event.preventDefault()
    await runAction(async () => {
      const q = maintSearchQuery.trim()
      if (q.length < 2) throw new Error('Maintenance search query must be at least 2 characters.')
      const response = await fetch(`/api/admin/film-search?q=${encodeURIComponent(q)}&limit=20`, { credentials: 'include' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Film search failed.')
      setMaintSearchResults(Array.isArray(payload.items) ? payload.items : [])
      setSuccess(`Found ${(payload.items || []).length} maintenance match(es).`)
    })
  }

  function useMaintenanceFilm(item) {
    setFilmIdInput(String(item.id || ''))
    setTmdbIdMaintInput(item.tmdbId ? String(item.tmdbId) : '')
    const current = Number.isFinite(Number(item.glicko)) ? Number(item.glicko) : Number(item.elo)
    setManualEloInput(Number.isFinite(current) ? String(Math.round(current)) : '')
  }

  async function setManualElo() {
    await runAction(async () => {
      const response = await fetch('/api/admin/set-elo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({
          filmId: filmIdInput ? Number(filmIdInput) : null,
          tmdbId: tmdbIdMaintInput ? Number(tmdbIdMaintInput) : null,
          elo: manualEloInput ? Number(manualEloInput) : null
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Set Elo failed.')
      setSuccess(`Set Elo for ${payload.film.title} to ${payload.elo}. Reset ${payload.deletedMatchCount || 0} match(es).`)
      setFilmIdInput(String(payload.film.id))
      setTmdbIdMaintInput(payload.film.tmdbId ? String(payload.film.tmdbId) : '')
      setManualEloInput(String(payload.elo))
      await loadHealth()
    })
  }

  if (!authenticated) {
    return (
      <div className="c-shell admin-page">
        <section className="c-card auth-card">
          <div className="c-card-header"><h1>Admin Access</h1></div>
          <div className="c-card-body">
            <p className="c-page-subtitle">Enter the scoring password to access admin tools.</p>
            <form className="c-form-stack auth-form" onSubmit={login}>
              <label htmlFor="admin-password">Password</label>
              <input id="admin-password" className="c-input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
              <button className="c-button" type="submit" disabled={loading}>Unlock</button>
            </form>
            {error ? <p className="c-status-error">{error}</p> : null}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="c-shell admin-page">
      <header className="c-page-header admin-header">
        <h1>Admin Tools</h1>
        <button className="c-button-quiet" disabled={loading} onClick={logout}>Logout</button>
      </header>

      <section className="c-card admin-card">
        <div className="c-card-header">
          <h2>Health</h2>
          <button className="c-button-quiet" disabled={loading} onClick={loadHealth}>Refresh</button>
        </div>
        <div className="c-card-body">
          {health
            ? (
              <div className="stats-grid">
                <div><span className="k">Films</span><strong>{health.films.total}</strong></div>
                <div><span className="k">TMDb</span><strong>{health.films.withTmdb}</strong></div>
                <div><span className="k">Fully Cached</span><strong>{health.films.fullyCached}</strong></div>
                <div><span className="k">Active Matches</span><strong>{health.scoring.activePendingMatches}</strong></div>
              </div>
              )
            : <p className="c-page-subtitle">No health snapshot loaded yet.</p>}
        </div>
      </section>

      <section className="c-card admin-card">
        <div className="c-card-header">
          <h2>Trakt Connection</h2>
          <button className="c-button-quiet" disabled={loading} onClick={async () => { await loadTraktStatus(); await loadJobs() }}>Refresh</button>
        </div>
        <div className="c-card-body">
          {traktStatus
            ? <p>Status: <strong>{traktStatus.connected ? 'Connected' : 'Not connected'}</strong>{traktStatus.expiresAt ? ` · expires ${traktStatus.expiresAt}` : ''}</p>
            : <p className="c-page-subtitle">Status unknown.</p>}
          {traktStatus?.redirectUri ? <p>Redirect URI: <code>{traktStatus.redirectUri}</code></p> : null}
          <form className="inline-form" onSubmit={startTraktDeviceAuth}>
            <button className="c-button" disabled={loading} type="button" onClick={beginTraktOAuthRedirect}>Connect Redirect OAuth</button>
            <button className="c-button" disabled={loading} type="submit">Start Device Auth</button>
            <button className="c-button-quiet" disabled={loading || !deviceAuth.deviceCode} type="button" onClick={pollTraktDeviceAuth}>Poll Token</button>
          </form>
          {deviceAuth.userCode
            ? <p>Enter code <code>{deviceAuth.userCode}</code> at <a href={deviceAuth.verificationUrlComplete} target="_blank" rel="noopener noreferrer">{deviceAuth.verificationUrlComplete}</a></p>
            : null}
        </div>
      </section>

      <section className="c-card admin-card">
        <div className="c-card-header">
          <h2>Trakt Sync Jobs</h2>
          <button className="c-button-quiet" disabled={loading} onClick={loadJobs}>Refresh Jobs</button>
        </div>
        <div className="c-card-body">
          <p>
            Last sync: <strong>{traktStatus?.sync?.lastSyncedAt || 'never'}</strong>
            {traktStatus?.sync?.pendingJobs ? ` · pending jobs ${traktStatus.sync.pendingJobs}` : ''}
          </p>
          <div className="inline-form">
            <button className="c-button" disabled={loading} onClick={() => queueTraktSync(false)}>Queue Sync</button>
            <button className="c-button-quiet" disabled={loading} onClick={() => queueTraktSync(true)}>Run Sync Now</button>
            <button className="c-button-quiet" disabled={loading} onClick={() => runQueuedJobs(1)}>Run 1 Queued Job</button>
          </div>
          {jobs.length
            ? (
              <ul className="results">
                {jobs.map((job) => (
                  <li key={job.id} className="result-row">
                    <div className="meta">
                      <strong>#{job.id}</strong> · <span>{job.type}</span> · <span>{job.status}</span>
                      <small>updated {job.updated_at || job.updatedAt || 'unknown'}</small>
                      {job.error ? <small>{job.error}</small> : null}
                    </div>
                  </li>
                ))}
              </ul>
              )
            : <p className="c-page-subtitle">No jobs yet.</p>}
        </div>
      </section>

      <section className="c-card admin-card">
        <div className="c-card-header"><h2>Manual Intake</h2></div>
        <div className="c-card-body">
          <form className="inline-form" onSubmit={searchTmdb}>
            <input className="c-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="text" placeholder="Search TMDb movies" />
            <button className="c-button" disabled={loading || searchQuery.trim().length < 2} type="submit">Search</button>
          </form>
          <form className="inline-form" onSubmit={addByTmdbId}>
            <input className="c-input" value={tmdbIdInput} onChange={(event) => setTmdbIdInput(event.target.value)} type="number" min="1" placeholder="TMDb ID" />
            <button className="c-button-quiet" disabled={loading || !tmdbIdInput} type="submit">Add by ID</button>
          </form>

          {searchResults.length
            ? (
              <ul className="results">
                {searchResults.map((item) => (
                  <li key={item.tmdbId} className="result-row">
                    <div className="meta">
                      <a href={item.tmdbUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>
                      {item.year ? <span> ({item.year})</span> : null}
                      {item.existing ? <small>Already in DB (#{item.existing.id})</small> : null}
                    </div>
                    <button className="c-button-quiet" disabled={loading} onClick={() => addFilm(item.tmdbId)}>{item.existing ? 'Refresh' : 'Add'}</button>
                  </li>
                ))}
              </ul>
              )
            : null}
        </div>
      </section>

      <section className="c-card admin-card">
        <div className="c-card-header"><h2>Film Maintenance</h2></div>
        <div className="c-card-body">
          <form className="inline-form" onSubmit={searchMaintenanceFilms}>
            <input className="c-input" value={maintSearchQuery} onChange={(event) => setMaintSearchQuery(event.target.value)} type="text" placeholder="Find film by title, Film ID, or TMDb ID" />
            <button className="c-button" disabled={loading || maintSearchQuery.trim().length < 2} type="submit">Find Film</button>
          </form>
          {maintSearchResults.length
            ? (
              <ul className="results">
                {maintSearchResults.map((item) => (
                  <li key={item.id} className="result-row">
                    <div className="meta">
                      <strong>{item.title}</strong>
                      {item.year ? <span> ({item.year})</span> : null}
                      <small>Film #{item.id}{item.tmdbId ? ` · TMDb ${item.tmdbId}` : ''} · Elo {item.glicko ?? item.elo ?? 'n/a'} · Matches {item.matches || 0}</small>
                    </div>
                    <button className="c-button-quiet" disabled={loading} onClick={() => useMaintenanceFilm(item)}>Use</button>
                  </li>
                ))}
              </ul>
              )
            : null}
          <div className="inline-form">
            <input className="c-input" value={filmIdInput} onChange={(event) => setFilmIdInput(event.target.value)} type="number" min="1" placeholder="Film ID" />
            <input className="c-input" value={tmdbIdMaintInput} onChange={(event) => setTmdbIdMaintInput(event.target.value)} type="number" min="1" placeholder="TMDb ID (optional)" />
            <input className="c-input" value={manualEloInput} onChange={(event) => setManualEloInput(event.target.value)} type="number" min="600" max="3000" placeholder="Manual Elo" />
          </div>
          <div className="inline-form">
            <button className="c-button-quiet" disabled={loading || (!filmIdInput && !tmdbIdMaintInput)} onClick={() => reseed(false)}>Reseed</button>
            <button className="c-button-quiet" disabled={loading || (!filmIdInput && !tmdbIdMaintInput)} onClick={() => reseed(true)}>Reseed + Reset Glicko</button>
            <button className="c-button-quiet" disabled={loading || (!filmIdInput && !tmdbIdMaintInput)} onClick={() => recache(false)}>Recache</button>
            <button className="c-button-quiet" disabled={loading || (!filmIdInput && !tmdbIdMaintInput)} onClick={() => recache(true)}>Force Recache</button>
            <button className="c-button" disabled={loading || (!filmIdInput && !tmdbIdMaintInput) || !manualEloInput} onClick={setManualElo}>Set Elo + Reset History</button>
          </div>
        </div>
      </section>

      {success ? <p className="c-status-success">{success}</p> : null}
      {error ? <p className="c-status-error">{error}</p> : null}
    </div>
  )
}
