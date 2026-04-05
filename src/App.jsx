import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ScorePage from './pages/ScorePage'
import AdminPage from './pages/AdminPage'
import TraktCallbackPage from './pages/TraktCallbackPage'
import AboutPage from './pages/AboutPage'

function AppNav({ hasSession, onLogout, logoutLoading }) {
  const location = useLocation()
  if (!hasSession || location.pathname === '/' || location.pathname === '/about') return null

  return (
    <nav className="site-nav" aria-label="Primary">
      <NavLink to="/" end>Rankings</NavLink>
      <NavLink to="/score">Scoring</NavLink>
      <NavLink to="/admin">Admin</NavLink>
      <div className="site-nav-spacer" />
      <button className="c-button-quiet site-nav-logout" type="button" disabled={logoutLoading} onClick={onLogout}>Logout</button>
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  const [hasSession, setHasSession] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  const refreshScoreSession = useCallback(async () => {
    try {
      const response = await fetch('/api/score/session', { credentials: 'include' })
      if (!response.ok) {
        setHasSession(false)
        return
      }
      const payload = await response.json()
      setHasSession(Boolean(payload.authenticated))
    } catch {
      setHasSession(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLogoutLoading(true)
    try {
      await fetch('/api/score/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-film-write-intent': '1' }
      })
    } finally {
      setHasSession(false)
      setLogoutLoading(false)
      window.dispatchEvent(new Event('score-auth-changed'))
    }
  }, [])

  useEffect(() => {
    refreshScoreSession()
  }, [refreshScoreSession, location.pathname])

  useEffect(() => {
    window.addEventListener('score-auth-changed', refreshScoreSession)
    return () => window.removeEventListener('score-auth-changed', refreshScoreSession)
  }, [refreshScoreSession])

  return (
    <>
      <div id="skip"><a className="skip-main" href="#main">Skip to main content</a></div>
      <AppNav hasSession={hasSession} onLogout={logout} logoutLoading={logoutLoading} />
      <main id="main" role="main" aria-label="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/score" element={<ScorePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/trakt/callback" element={<TraktCallbackPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<div className="c-shell"><div className="c-card c-card-body"><h1>Not Found</h1><p><Link to="/">Go back home</Link></p></div></div>} />
        </Routes>
      </main>
    </>
  )
}
