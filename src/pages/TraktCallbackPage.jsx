import { Link, useLocation } from 'react-router-dom'

export default function TraktCallbackPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const code = params.get('code') || ''
  const error = params.get('error') || ''

  return (
    <div className="c-shell callback-page">
      <section className="c-card callback-card">
        <div className="c-card-header"><h1>Trakt Callback</h1></div>
        <div className="c-card-body">
          <p className="c-page-subtitle">This endpoint is configured for Trakt OAuth redirects.</p>
          {code ? <p>Received code: <code>{code}</code></p> : null}
          {!code && error ? <p>OAuth error: <code>{error}</code></p> : null}
          {!code && !error ? <p>No authorization code was provided in the query string.</p> : null}
          <p><Link to="/admin">Back to Admin</Link></p>
        </div>
      </section>
    </div>
  )
}
