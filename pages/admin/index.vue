<template>
  <main class="admin-page">
    <section
      v-if="!authenticated"
      class="auth-panel"
    >
      <h1>Admin Access</h1>
      <p>Enter the scoring password to access admin tools.</p>
      <form @submit.prevent="login">
        <label for="admin-password">Password</label>
        <input
          id="admin-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
        >
        <button
          type="submit"
          :disabled="loading"
        >
          Unlock
        </button>
      </form>
      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
    </section>

    <section
      v-else
      class="admin-panel"
    >
      <header class="panel-header">
        <h1>Admin Tools</h1>
        <button
          class="logout"
          :disabled="loading"
          @click="logout"
        >
          Logout
        </button>
      </header>

      <section class="card">
        <div class="card-top">
          <h2>Health</h2>
          <button :disabled="loading" @click="loadHealth">Refresh</button>
        </div>
        <div v-if="health" class="stats-grid">
          <div>
            <span class="k">Films</span>
            <strong>{{ health.films.total }}</strong>
          </div>
          <div>
            <span class="k">TMDb</span>
            <strong>{{ health.films.withTmdb }}</strong>
          </div>
          <div>
            <span class="k">Fully Cached</span>
            <strong>{{ health.films.fullyCached }}</strong>
          </div>
          <div>
            <span class="k">Active Matches</span>
            <strong>{{ health.scoring.activePendingMatches }}</strong>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-top">
          <h2>Trakt Connection</h2>
          <button :disabled="loading" @click="loadTraktStatus">Refresh</button>
        </div>
        <p v-if="traktStatus">
          Status:
          <strong>{{ traktStatus.connected ? 'Connected' : 'Not connected' }}</strong>
          <span v-if="traktStatus.expiresAt"> · expires {{ traktStatus.expiresAt }}</span>
        </p>
        <p v-if="traktStatus?.redirectUri">
          Redirect URI: <code>{{ traktStatus.redirectUri }}</code>
        </p>
        <form class="id-form" @submit.prevent="startTraktDeviceAuth">
          <button :disabled="loading" type="submit">Start Device Auth</button>
          <button
            :disabled="loading || !deviceAuth.deviceCode"
            type="button"
            @click="pollTraktDeviceAuth"
          >
            Poll Token
          </button>
        </form>
        <p v-if="deviceAuth.userCode">
          Enter code <code>{{ deviceAuth.userCode }}</code> at
          <a :href="deviceAuth.verificationUrlComplete" target="_blank" rel="noopener noreferrer">{{ deviceAuth.verificationUrlComplete }}</a>
        </p>
      </section>

      <section class="card">
        <h2>Manual Intake</h2>
        <form class="search-form" @submit.prevent="searchTmdb">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search TMDb movies"
          >
          <button :disabled="loading || searchQuery.trim().length < 2" type="submit">Search</button>
        </form>

        <form class="id-form" @submit.prevent="addByTmdbId">
          <input
            v-model.number="tmdbIdInput"
            type="number"
            min="1"
            placeholder="TMDb ID"
          >
          <button :disabled="loading || !tmdbIdInput" type="submit">Add by ID</button>
        </form>

        <ul v-if="searchResults.length" class="results">
          <li v-for="item in searchResults" :key="item.tmdbId" class="result-row">
            <div class="meta">
              <a :href="item.tmdbUrl" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
              <span v-if="item.year">({{ item.year }})</span>
              <small v-if="item.existing">Already in DB (#{{ item.existing.id }})</small>
            </div>
            <button
              :disabled="loading"
              @click="addFilm(item.tmdbId)"
            >
              {{ item.existing ? 'Refresh' : 'Add' }}
            </button>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2>Film Maintenance</h2>
        <form class="id-form" @submit.prevent="noop">
          <input
            v-model.number="filmIdInput"
            type="number"
            min="1"
            placeholder="Film ID"
          >
          <input
            v-model.number="tmdbIdMaintInput"
            type="number"
            min="1"
            placeholder="TMDb ID (optional)"
          >
          <button :disabled="loading || (!filmIdInput && !tmdbIdMaintInput)" @click.prevent="reseed(false)">Reseed</button>
          <button :disabled="loading || (!filmIdInput && !tmdbIdMaintInput)" @click.prevent="reseed(true)">Reseed + Reset Glicko</button>
          <button :disabled="loading || (!filmIdInput && !tmdbIdMaintInput)" @click.prevent="recache(false)">Recache</button>
          <button :disabled="loading || (!filmIdInput && !tmdbIdMaintInput)" @click.prevent="recache(true)">Force Recache</button>
        </form>
      </section>

      <p v-if="success" class="success">{{ success }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </main>
</template>

<script>
export default {
  name: 'AdminPage',
  data () {
    return {
      authenticated: false,
      loading: false,
      password: '',
      error: '',
      success: '',
      health: null,
      traktStatus: null,
      deviceAuth: {
        deviceCode: '',
        userCode: '',
        verificationUrlComplete: ''
      },
      searchQuery: '',
      searchResults: [],
      tmdbIdInput: null,
      filmIdInput: null,
      tmdbIdMaintInput: null
    }
  },
  async mounted () {
    await this.checkSession()
    if (this.authenticated) {
      await this.loadHealth()
      await this.loadTraktStatus()
    }
  },
  methods: {
    noop () {},
    async checkSession () {
      const response = await fetch('/api/score/session', { credentials: 'include' })
      if (!response.ok) return
      const payload = await response.json()
      this.authenticated = Boolean(payload.authenticated)
    },
    async login () {
      this.loading = true
      this.error = ''
      this.success = ''
      try {
        const response = await fetch('/api/score/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({ password: this.password })
        })
        if (!response.ok) throw new Error('Invalid password.')
        this.password = ''
        this.authenticated = true
        window.dispatchEvent(new Event('score-auth-changed'))
        await this.loadHealth()
        await this.loadTraktStatus()
      } catch (error) {
        this.error = error.message || 'Login failed.'
      } finally {
        this.loading = false
      }
    },
    async logout () {
      await fetch('/api/score/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-film-write-intent': '1' }
      })
      this.authenticated = false
      this.health = null
      this.traktStatus = null
      this.deviceAuth = { deviceCode: '', userCode: '', verificationUrlComplete: '' }
      this.searchResults = []
      window.dispatchEvent(new Event('score-auth-changed'))
    },
    async loadHealth () {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/health', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to load admin health.')
        this.health = await response.json()
        this.success = `Health refreshed at ${new Date().toLocaleTimeString()}`
      })
    },
    async loadTraktStatus () {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/trakt-status', { credentials: 'include' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to load Trakt status.')
        this.traktStatus = payload
      })
    },
    async startTraktDeviceAuth () {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/trakt-auth-start', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-film-write-intent': '1' }
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to start Trakt auth.')
        this.deviceAuth = {
          deviceCode: payload.deviceCode,
          userCode: payload.userCode,
          verificationUrlComplete: payload.verificationUrlComplete
        }
        this.success = `Trakt code generated. Expires in ${payload.expiresIn}s.`
      })
    },
    async pollTraktDeviceAuth () {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/trakt-auth-poll', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({ deviceCode: this.deviceAuth.deviceCode })
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to poll Trakt token.')
        if (payload.pending) {
          this.success = 'Still waiting for authorization. Complete Trakt verification and poll again.'
          return
        }
        this.success = 'Trakt connected successfully.'
        await this.loadTraktStatus()
      })
    },
    async searchTmdb () {
      await this.runAction(async () => {
        const q = this.searchQuery.trim()
        if (q.length < 2) throw new Error('Search query must be at least 2 characters.')
        const response = await fetch(`/api/admin/tmdb-search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
        if (!response.ok) throw new Error('TMDb search failed.')
        const payload = await response.json()
        this.searchResults = payload.items || []
        this.success = `Found ${this.searchResults.length} result(s).`
      })
    },
    async addByTmdbId () {
      if (!this.tmdbIdInput) return
      await this.addFilm(this.tmdbIdInput)
    },
    async addFilm (tmdbId) {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/intake-add', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({ tmdbId: Number(tmdbId) })
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Failed to add film.')
        this.success = payload.created
          ? `Added ${payload.film.title}. Images cached: ${payload.cached ? 'yes' : 'no'}.`
          : `Updated ${payload.film.title}. Images cached: ${payload.cached ? 'yes' : 'no'}.`
        await this.loadHealth()
      })
    },
    async reseed (resetGlicko) {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/reseed', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({
            filmId: this.filmIdInput || null,
            tmdbId: this.tmdbIdMaintInput || null,
            resetGlicko
          })
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Reseed failed.')
        this.success = `Reseeded ${payload.film.title}${resetGlicko ? ' and reset Glicko' : ''}.`
      })
    },
    async recache (force) {
      await this.runAction(async () => {
        const response = await fetch('/api/admin/recache', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-film-write-intent': '1' },
          body: JSON.stringify({
            filmId: this.filmIdInput || null,
            tmdbId: this.tmdbIdMaintInput || null,
            force
          })
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Recache failed.')
        this.success = payload.cached
          ? `Recached posters for ${payload.film.title}.`
          : `No recache performed for ${payload.film.title}: ${payload.reason || 'unchanged'}.`
        await this.loadHealth()
      })
    },
    async runAction (fn) {
      this.loading = true
      this.error = ''
      try {
        await fn()
      } catch (error) {
        this.success = ''
        this.error = error.message || 'Request failed.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss">
.admin-page {
  min-height: 100vh;
  padding: 1.25rem 1rem 3rem;
  color: #eef0f2;
  background: radial-gradient(circle at 10% 10%, #2b1e47 0%, #111827 48%, #0a0f1f 100%);
}

.auth-panel,
.admin-panel {
  max-width: 72rem;
  margin: 0 auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  h1 {
    margin: 0;
  }
}

.card {
  margin-top: 1rem;
  border: 1px solid rgba(148, 166, 193, 0.35);
  border-radius: 0.4rem;
  padding: 0.9rem;
  background: rgba(15, 23, 42, 0.72);
}

.card h2 {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.7rem;
}

.stats-grid > div {
  padding: 0.6rem;
  border: 1px solid rgba(148, 166, 193, 0.35);
  border-radius: 0.3rem;
  background: rgba(3, 8, 20, 0.45);
}

.k {
  display: block;
  color: #9fb1d6;
  font-size: 0.8rem;
}

.search-form,
.id-form,
.auth-panel form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

input,
button {
  border-radius: 0.25rem;
  border: 1px solid #4c6090;
  background: #12203f;
  color: #eef0f2;
  padding: 0.55rem 0.72rem;
}

button {
  background: #2450c2;
  border-color: #6b88de;
  cursor: pointer;
}

.logout {
  background: transparent;
  border-color: #617394;
}

.results {
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(148, 166, 193, 0.25);
  border-radius: 0.3rem;
  padding: 0.55rem;
}

.meta {
  min-width: 0;
}

.meta a {
  color: #d8e6ff;
  text-decoration: none;
}

.meta small {
  display: block;
  color: #8ba3ce;
}

.success {
  margin-top: 0.8rem;
  color: #8df1af;
}

.error {
  margin-top: 0.8rem;
  color: #ff9a9a;
}

@media (max-width: 720px) {
  .result-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
