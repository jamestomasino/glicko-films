import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const [films, setFilms] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeMatchId, setActiveMatchId] = useState(null)
  const sentinelRef = useRef(null)
  const initializedRef = useRef(false)
  const rowRefs = useRef(new Map())
  const searchInputRef = useRef(null)

  useEffect(() => {
    document.title = 'Tomasino Film Rankings'
  }, [])

  const fetchFilmsPage = useCallback(async (nextOffset, limit = 100) => {
    const response = await fetch(`/api/films?offset=${nextOffset}&limit=${limit}`)
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }
    const payload = await response.json()
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      total: Number(payload.total) || 0,
      hasMore: Boolean(payload.hasMore)
    }
  }, [])

  const fetchNextPage = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    setError('')

    try {
      const payload = await fetchFilmsPage(offset, 100)
      const items = payload.items
      setFilms((current) => current.concat(items))
      setOffset((current) => current + items.length)
      setTotal(payload.total)
      setHasMore(payload.hasMore)
    } catch {
      setError('Could not load films right now.')
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [fetchFilmsPage, hasMore, loading, offset])

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

  useEffect(() => {
    if (!searchOpen) return
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [searchOpen])

  const fuzzyIndex = useMemo(() => (
    films.map((film) => ({
      film,
      normalizedTitle: normalizeSearchText(film.title),
      normalizedYear: film.year ? String(film.year) : ''
    }))
  ), [films])

  const findBestMatch = useCallback((query) => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return null
    let best = null
    for (const entry of fuzzyIndex) {
      const score = fuzzyScore(normalizedQuery, entry.normalizedTitle, entry.normalizedYear)
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = { film: entry.film, score }
      }
    }
    return best
  }, [fuzzyIndex])

  const scrollToFilmRow = useCallback((filmId) => {
    let attempts = 0
    const maxAttempts = 10
    const tryScroll = () => {
      const element = rowRefs.current.get(filmId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      attempts += 1
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 100)
      }
    }
    tryScroll()
  }, [])

  async function handleSearchSubmit(event) {
    event.preventDefault()
    const rawQuery = searchQuery.trim()
    if (!rawQuery) return

    setSearching(true)
    setSearchError('')
    setActiveMatchId(null)

    try {
      let currentFilms = films
      let currentOffset = offset
      let currentHasMore = hasMore
      let best = findBestMatch(rawQuery)

      while ((!best || best.score < 0.75) && currentHasMore) {
        const payload = await fetchFilmsPage(currentOffset, 100)
        const items = payload.items
        if (!items.length) {
          currentHasMore = false
          setHasMore(false)
          break
        }

        currentFilms = currentFilms.concat(items)
        currentOffset += items.length
        currentHasMore = payload.hasMore

        setFilms(currentFilms)
        setOffset(currentOffset)
        setTotal(payload.total)
        setHasMore(currentHasMore)

        const indexed = currentFilms.map((film) => ({
          film,
          normalizedTitle: normalizeSearchText(film.title),
          normalizedYear: film.year ? String(film.year) : ''
        }))
        best = findBestMatchInIndex(rawQuery, indexed)
      }

      if (!best || best.score < 0.45) {
        setSearchError('No close match found in your collection.')
        return
      }

      const matchId = best.film.id
      setActiveMatchId(matchId)
      scrollToFilmRow(matchId)
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="c-shell rankings-page">
      <header className="c-page-header">
        <div className="home-header-top">
          <h1>Tomasino Film Rankings</h1>
          <div className="home-header-actions">
            <button
              className="c-button-quiet film-search-toggle"
              type="button"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <Link className="about-link" to="/about">About</Link>
          </div>
        </div>
        <p className="c-page-subtitle">Showing {films.length} of {total || '...'} films.</p>
        {searchOpen
          ? (
            <form className="film-search-form" onSubmit={handleSearchSubmit}>
              <input
                ref={searchInputRef}
                className="c-input film-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Find a film rating..."
                aria-label="Find a film rating"
              />
              <button className="c-button" type="submit" disabled={searching || !searchQuery.trim()}>
                {searching ? 'Searching...' : 'Find'}
              </button>
            </form>
            )
          : null}
        {searchError ? <p className="c-status-error">{searchError}</p> : null}
      </header>

      <div className="film-columns-head">
        <span className="col-head col-head-left">Rank</span>
        <span />
        <span className="col-head col-head-left">Title</span>
        <span className="col-head">Elo</span>
        <span className="col-head">Confidence</span>
        <span className="col-head">Matches</span>
      </div>

      <ol className="film-list c-card">
        {films.map((film) => (
          <li
            key={film.id}
            id={`film-${film.id}`}
            ref={(element) => {
              if (element) rowRefs.current.set(film.id, element)
              else rowRefs.current.delete(film.id)
            }}
            className={`film-row ${activeMatchId === film.id ? 'film-row-active' : ''}`}
          >
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
                    ? <img className="poster" src={film.thumbnailUrl} alt={`${film.title} poster`} loading="lazy" decoding="async" width="200" height="300" />
                    : <div className="poster-fallback" aria-hidden="true" />}
                </a>
                )
              : <div className="poster-fallback" aria-hidden="true" />}

            <div className="film-meta">
              <div className="title">{film.title}</div>
              <div className="subline">
                {film.year ? <span className="year">{film.year}</span> : null}
              </div>
            </div>

            <div className="film-stat">
              <span className="film-stat-mobile-label">Elo</span>
              <span className="film-stat-value">{film.elo}</span>
            </div>

            <div className="film-stat">
              <span className="film-stat-mobile-label">Confidence</span>
              <span className={`film-stat-value ${confidenceClass(film.rd)}`}>{toConfidence(film.rd)}% (RD {displayRd(film.rd)})</span>
            </div>

            <div className="film-stat">
              <span className="film-stat-mobile-label">Matches</span>
              <span className="film-stat-value">{film.matches || 0}</span>
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

function findBestMatchInIndex(query, index) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return null
  let best = null
  for (const entry of index) {
    const score = fuzzyScore(normalizedQuery, entry.normalizedTitle, entry.normalizedYear)
    if (score <= 0) continue
    if (!best || score > best.score) {
      best = { film: entry.film, score }
    }
  }
  return best
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyScore(query, title, year = '') {
  if (!query || !title) return 0
  if (title === query) return 1
  if (title.startsWith(query)) return 0.97
  if (title.includes(query)) return 0.9
  if (year && query.includes(year)) return 0.86

  const queryTokens = query.split(' ').filter(Boolean)
  const titleTokens = title.split(' ').filter(Boolean)
  if (!queryTokens.length || !titleTokens.length) return 0

  const tokenHits = queryTokens.reduce((count, token) => {
    if (titleTokens.includes(token)) return count + 1
    if (title.includes(token)) return count + 0.75
    return count
  }, 0)
  const tokenRatio = tokenHits / queryTokens.length
  if (tokenRatio >= 0.95) return 0.84
  if (tokenRatio >= 0.75) return 0.72

  const subseq = subsequenceRatio(query, title)
  if (subseq >= 0.9) return 0.66
  if (subseq >= 0.75) return 0.52
  return 0
}

function subsequenceRatio(query, title) {
  if (!query || !title) return 0
  let q = 0
  let t = 0
  while (q < query.length && t < title.length) {
    if (query[q] === title[t]) q += 1
    t += 1
  }
  return q / query.length
}

function displayRd(rd) {
  if (!Number.isFinite(Number(rd))) return 200
  return Math.max(50, Math.min(300, Math.round(Number(rd))))
}

function toConfidence(rd) {
  const normalizedRd = displayRd(rd)
  const confidence = (1 - Math.max(0, Math.min(1, (normalizedRd - 50) / 250))) * 100
  return Math.round(confidence)
}

function confidenceClass(rd) {
  const confidence = toConfidence(rd)
  if (confidence >= 90) return 'confidence-very-high'
  if (confidence >= 80) return 'confidence-high'
  if (confidence >= 70) return 'confidence-medium'
  if (confidence >= 60) return 'confidence-low'
  return 'confidence-very-low'
}
