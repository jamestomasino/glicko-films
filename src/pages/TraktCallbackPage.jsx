import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function TraktCallbackPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const code = params.get('code') || ''
  const error = params.get('error') || ''
  const state = params.get('state') || ''
  const [status, setStatus] = useState(code ? 'completing' : 'idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.title = 'Trakt Callback · Tomasino Film Rankings'
  }, [])

  useEffect(() => {
    if (!code) return
    let cancelled = false

    async function completeCallback () {
      try {
        const response = await fetch('/api/admin/trakt-auth-callback', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({ code, state })
        })
        const payload = await response.json()
        if (cancelled) return
        if (!response.ok) {
          setStatus('error')
          setMessage(payload.error || 'Failed to complete callback.')
          return
        }
        setStatus('success')
        setMessage(`Connected. Token expires ${payload.expiresAt || 'unknown'}.`)
      } catch {
        if (cancelled) return
        setStatus('error')
        setMessage('Failed to complete callback.')
      }
    }

    void completeCallback()
    return () => { cancelled = true }
  }, [code, state])

  return (
    <div className="c-shell callback-page">
      <section className="c-card callback-card">
        <div className="c-card-header"><h1>Trakt Callback</h1></div>
        <div className="c-card-body">
          <p className="c-page-subtitle">This endpoint is configured for Trakt OAuth redirects.</p>
          {code ? <p>Authorization code received.</p> : null}
          {!code && error ? <p>OAuth error: <code>{error}</code></p> : null}
          {!code && !error ? <p>No authorization code was provided in the query string.</p> : null}
          {status === 'completing' ? <p>Completing OAuth handshake...</p> : null}
          {status === 'success' ? <p className="c-status-success">{message}</p> : null}
          {status === 'error' ? <p className="c-status-error">{message}</p> : null}
          <p><Link to="/admin">Back to Admin</Link></p>
        </div>
      </section>
    </div>
  )
}
