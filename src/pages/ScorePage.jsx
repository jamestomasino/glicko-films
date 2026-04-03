import { useEffect, useMemo, useState } from 'react'
import { findOptionLabel, resolveStartValue, strategyLabel } from '../lib/score'

export default function ScorePage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [state, setState] = useState(null)
  const [startPairing, setStartPairing] = useState('swiss')
  const [startBand, setStartBand] = useState('normal')
  const [startRange, setStartRange] = useState('random')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Score Films · Tomasino Film Rankings'
    void checkSession()
  }, [])

  async function checkSession() {
    const response = await fetch('/api/score/session', { credentials: 'include' })
    if (!response.ok) return
    const payload = await response.json()
    const session = Boolean(payload.authenticated)
    setAuthenticated(session)
    if (session) {
      await loadState()
    }
  }

  async function login(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/score/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ password })
      })
      if (!response.ok) {
        throw new Error('Invalid password.')
      }
      setPassword('')
      setAuthenticated(true)
      window.dispatchEvent(new Event('score-auth-changed'))
      await loadState()
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function loadState() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/score/state', { credentials: 'include' })
      if (response.status === 401) {
        setAuthenticated(false)
        setState(null)
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load scoring state.')
      }
      const payload = await response.json()
      setState(payload)

      const defaults = payload?.startOptions?.defaults || {}
      setStartPairing((current) => resolveStartValue(payload?.startOptions?.pairing || [], current, defaults.pairing, 'swiss'))
      setStartBand((current) => resolveStartValue(payload?.startOptions?.band || [], current, defaults.band, 'normal'))
      setStartRange((current) => resolveStartValue(payload?.startOptions?.range || [], current, defaults.range, 'random'))
    } catch (err) {
      setError(err.message || 'Failed to load scoring state.')
    } finally {
      setLoading(false)
    }
  }

  async function submit(outcome) {
    if (!state?.matchup) return

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/score/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({
          matchId: state.matchup.matchId,
          tournamentId: state.matchup.tournamentId,
          outcome
        })
      })
      if (!response.ok) {
        throw new Error('Failed to submit result.')
      }
      setState(await response.json())
    } catch (err) {
      setError(err.message || 'Failed to submit result.')
    } finally {
      setLoading(false)
    }
  }

  async function startTournament() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/score/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
        body: JSON.stringify({ pairing: startPairing, band: startBand, range: startRange })
      })
      if (!response.ok) {
        throw new Error('Failed to start tournament.')
      }
      setState(await response.json())
    } catch (err) {
      setError(err.message || 'Failed to start tournament.')
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
    setState(null)
    setPassword('')
    setStartPairing('swiss')
    setStartBand('normal')
    setStartRange('random')
    window.dispatchEvent(new Event('score-auth-changed'))
  }

  const selectedStartSummary = useMemo(() => {
    const pairingLabel = findOptionLabel(state?.startOptions?.pairing || [], startPairing)
    const bandLabel = findOptionLabel(state?.startOptions?.band || [], startBand)
    const rangeLabel = findOptionLabel(state?.startOptions?.range || [], startRange)
    return `${pairingLabel} · ${bandLabel} · ${rangeLabel}`
  }, [state, startPairing, startBand, startRange])

  if (!authenticated) {
    return (
      <div className="c-shell score-page">
        <section className="c-card auth-card">
          <div className="c-card-header"><h1>Scoring Access</h1></div>
          <div className="c-card-body">
            <p className="c-page-subtitle">Enter the scoring password to continue.</p>
            <form className="c-form-stack auth-form" onSubmit={login}>
              <label htmlFor="score-password">Password</label>
              <input id="score-password" className="c-input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
              <button className="c-button" type="submit" disabled={loading}>Unlock</button>
            </form>
            {error ? <p className="c-status-error">{error}</p> : null}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="c-shell score-page">
      <section className="battle-panel">
        <header className="c-page-header battle-header">
          <div className="battle-header-row">
            <h1>Head-to-Head Scoring</h1>
            <button className="c-button-quiet" disabled={loading} onClick={logout}>Logout</button>
          </div>
          {state?.matchup ? <p className="c-page-subtitle">Tournament #{state?.tournament?.id} · {state?.pendingCount} matches remaining · {strategyLabel(state?.tournament?.strategy)}</p> : null}
          {!state?.matchup && state?.justCompleted ? <p className="c-page-subtitle">Tournament #{state?.tournament?.id} complete. Ratings applied.</p> : null}
          {!state?.matchup && !state?.justCompleted ? <p className="c-page-subtitle">No active tournament.</p> : null}
        </header>

        {state?.matchup
          ? (
            <div className="battle-grid">
              <article className="c-card film-card">
                <button className="poster-pick" disabled={loading} aria-label={`Choose ${state.matchup.leftFilm.title}`} onClick={() => submit('left')}>
                  {state.matchup.leftFilm.coverUrl
                    ? <img className="film-poster" src={state.matchup.leftFilm.coverUrl} alt={`${state.matchup.leftFilm.title} poster`} />
                    : <span className="poster-fallback" aria-hidden="true" />}
                </button>
                <div className="film-title">{state.matchup.leftFilm.title} {state.matchup.leftFilm.year ? `(${state.matchup.leftFilm.year})` : ''}</div>
              </article>

              <div className="draw-column">
                <button className="c-button-quiet draw-btn" disabled={loading} onClick={() => submit('draw')}>Draw</button>
              </div>

              <article className="c-card film-card">
                <button className="poster-pick" disabled={loading} aria-label={`Choose ${state.matchup.rightFilm.title}`} onClick={() => submit('right')}>
                  {state.matchup.rightFilm.coverUrl
                    ? <img className="film-poster" src={state.matchup.rightFilm.coverUrl} alt={`${state.matchup.rightFilm.title} poster`} />
                    : <span className="poster-fallback" aria-hidden="true" />}
                </button>
                <div className="film-title">{state.matchup.rightFilm.title} {state.matchup.rightFilm.year ? `(${state.matchup.rightFilm.year})` : ''}</div>
              </article>
            </div>
            )
          : (
            <section className="c-card start-panel">
              <div className="c-card-header"><h2>Start Tournament</h2></div>
              <div className="c-card-body">
                <p className="c-page-subtitle">Choose pairing, band size, and Elo range.</p>
                <div className="mode-grid">
                  <div className="mode-group">
                    <h3>Pairing</h3>
                    {(state?.startOptions?.pairing || []).map((option) => (
                      <label key={option.id} className="mode-option">
                        <input type="radio" name="start-pairing" value={option.id} checked={startPairing === option.id} onChange={() => setStartPairing(option.id)} />
                        <span className="mode-title">{option.label}</span>
                        <span className="mode-description">{option.description}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mode-group">
                    <h3>Band Size</h3>
                    {(state?.startOptions?.band || []).map((option) => (
                      <label key={option.id} className="mode-option">
                        <input type="radio" name="start-band" value={option.id} checked={startBand === option.id} onChange={() => setStartBand(option.id)} />
                        <span className="mode-title">{option.label}</span>
                        <span className="mode-description">{option.description}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mode-group">
                    <h3>Elo Range</h3>
                    {(state?.startOptions?.range || []).map((option) => (
                      <label key={option.id} className="mode-option">
                        <input type="radio" name="start-range" value={option.id} checked={startRange === option.id} onChange={() => setStartRange(option.id)} />
                        <span className="mode-title">{option.label}</span>
                        <span className="mode-description">{option.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="c-button" disabled={loading} onClick={startTournament}>Start {selectedStartSummary} Tournament</button>
              </div>
            </section>
            )}

        {error ? <p className="c-status-error">{error}</p> : null}
      </section>
    </div>
  )
}
