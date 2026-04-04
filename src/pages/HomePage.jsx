import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const [films, setFilms] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const sentinelRef = useRef(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    document.title = 'Tomasino Film Rankings'
  }, [])

  const fetchNextPage = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/films?offset=${offset}&limit=100`)
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }
      const payload = await response.json()
      const items = Array.isArray(payload.items) ? payload.items : []
      setFilms((current) => current.concat(items))
      setOffset((current) => current + items.length)
      setTotal(Number(payload.total) || 0)
      setHasMore(Boolean(payload.hasMore))
    } catch {
      setError('Could not load films right now.')
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [hasMore, loading, offset])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void fetchNextPage()
  }, [fetchNextPage])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    if (!window.IntersectionObserver) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage()
      }
    }, { rootMargin: '600px 0px' })

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchNextPage, hasMore])

  return (
    <div className="c-shell rankings-page">
      <header className="c-page-header">
        <div className="home-header-top">
          <h1>Tomasino Film Rankings</h1>
          <Link className="about-link" to="/about">About</Link>
        </div>
        <p className="c-page-subtitle">Showing {films.length} of {total || '...'} films.</p>
      </header>

      <ol className="film-list c-card">
        {films.map((film) => (
          <li key={film.id} className="film-row">
            <span className="position">#{film.position}</span>
            {film.tmdbUrl
              ? (
                <a
                  className="poster-link"
                  href={film.tmdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${film.title} on TMDb`}
                >
                  {film.thumbnailUrl
                    ? <img className="poster" src={film.thumbnailUrl} alt={`${film.title} poster`} loading="lazy" decoding="async" />
                    : <div className="poster-fallback" aria-hidden="true" />}
                </a>
                )
              : <div className="poster-fallback" aria-hidden="true" />}

            <div className="film-meta">
              <div className="title">{film.title}</div>
              <div className="subline">
                {film.year ? <span className="year">{film.year}</span> : null}
                <span className="elo">Elo {film.elo}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />

      {loading ? <p className="status">Loading more films...</p> : null}
      {!loading && error ? <p className="status c-status-error">{error}</p> : null}
      {!loading && !error && !hasMore && films.length > 0 ? <p className="status">End of list.</p> : null}
    </div>
  )
}
