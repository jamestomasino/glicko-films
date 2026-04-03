<template>
  <main class="score-page">
    <section
      v-if="!authenticated"
      class="auth-panel"
    >
      <h1>Scoring Access</h1>
      <p>Enter the scoring password to continue.</p>
      <form @submit.prevent="login">
        <label for="score-password">Password</label>
        <input
          id="score-password"
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
      class="battle-panel"
    >
      <header class="battle-header">
        <div class="battle-header-top">
          <h1>Head-to-Head Scoring</h1>
          <button
            class="logout"
            :disabled="loading"
            @click="logout"
          >
            Logout
          </button>
        </div>
        <p v-if="state?.matchup">Tournament #{{ state?.tournament?.id }} · {{ state?.pendingCount }} matches remaining · {{ strategyLabel(state?.tournament?.strategy) }}</p>
        <p v-else-if="state?.justCompleted">Tournament #{{ state?.tournament?.id }} complete. Ratings applied.</p>
        <p v-else>No active tournament.</p>
      </header>

      <div
        v-if="state?.matchup"
        class="battle-grid"
      >
        <article class="film-card">
          <button
            class="poster-pick"
            :disabled="loading"
            :aria-label="`Choose ${state.matchup.leftFilm.title}`"
            @click="submit('left')"
          >
            <img
              v-if="state.matchup.leftFilm.coverUrl"
              :src="state.matchup.leftFilm.coverUrl"
              :alt="`${state.matchup.leftFilm.title} poster`"
            >
          </button>
          <div class="film-title">
            {{ state.matchup.leftFilm.title }} <span v-if="state.matchup.leftFilm.year">({{ state.matchup.leftFilm.year }})</span>
          </div>
        </article>

        <div class="draw-column">
          <button
            class="draw-btn"
            :disabled="loading"
            @click="submit('draw')"
          >
            Draw
          </button>
        </div>

        <article class="film-card">
          <button
            class="poster-pick"
            :disabled="loading"
            :aria-label="`Choose ${state.matchup.rightFilm.title}`"
            @click="submit('right')"
          >
            <img
              v-if="state.matchup.rightFilm.coverUrl"
              :src="state.matchup.rightFilm.coverUrl"
              :alt="`${state.matchup.rightFilm.title} poster`"
            >
          </button>
          <div class="film-title">
            {{ state.matchup.rightFilm.title }} <span v-if="state.matchup.rightFilm.year">({{ state.matchup.rightFilm.year }})</span>
          </div>
        </article>
      </div>

      <section
        v-else
        class="start-panel"
      >
        <h2>Ready for a new batch?</h2>
        <p>Start a tournament when you want to continue scoring.</p>
        <div class="mode-grid">
          <label
            v-for="mode in state?.modes || []"
            :key="mode.id"
            class="mode-option"
          >
            <input
              v-model="startMode"
              type="radio"
              name="start-mode"
              :value="mode.id"
            >
            <span class="mode-title">{{ mode.label }}</span>
            <span class="mode-description">{{ mode.description }}</span>
          </label>
        </div>
        <button
          :disabled="loading"
          @click="startTournament"
        >
          Start {{ selectedModeLabel }} Tournament
        </button>
      </section>

      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
    </section>
  </main>
</template>

<script>
export default {
  name: 'ScorePage',
  data () {
    return {
      authenticated: false,
      password: '',
      state: null,
      startMode: 'normal',
      error: '',
      loading: false
    }
  },
  async mounted () {
    await this.checkSession()
    if (this.authenticated) {
      await this.loadState()
    }
  },
  methods: {
    async checkSession () {
      const response = await fetch('/api/score/session', { credentials: 'include' })
      if (!response.ok) return
      const payload = await response.json()
      this.authenticated = Boolean(payload.authenticated)
    },
    async login () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetch('/api/score/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: this.password })
        })
        if (!response.ok) {
          throw new Error('Invalid password.')
        }
        this.password = ''
        this.authenticated = true
        window.dispatchEvent(new Event('score-auth-changed'))
        await this.loadState()
      } catch (error) {
        this.error = error.message || 'Login failed.'
      } finally {
        this.loading = false
      }
    },
    async loadState () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetch('/api/score/state', {
          credentials: 'include'
        })
        if (response.status === 401) {
          this.authenticated = false
          this.state = null
          return
        }
        if (!response.ok) {
          throw new Error('Failed to load scoring state.')
        }
        this.state = await response.json()
        if (this.state?.modes?.some((mode) => mode.id === this.startMode)) return
        this.startMode = this.state?.modes?.[0]?.id || 'normal'
      } catch (error) {
        this.error = error.message || 'Failed to load scoring state.'
      } finally {
        this.loading = false
      }
    },
    async submit (outcome) {
      if (!this.state?.matchup) return

      this.loading = true
      this.error = ''
      try {
        const response = await fetch('/api/score/submit', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            matchId: this.state.matchup.matchId,
            tournamentId: this.state.matchup.tournamentId,
            outcome
          })
        })
        if (!response.ok) {
          throw new Error('Failed to submit result.')
        }
        this.state = await response.json()
      } catch (error) {
        this.error = error.message || 'Failed to submit result.'
      } finally {
        this.loading = false
      }
    },
    async startTournament () {
      this.loading = true
      this.error = ''
      try {
        const response = await fetch('/api/score/start', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: this.startMode })
        })
        if (!response.ok) {
          throw new Error('Failed to start tournament.')
        }
        this.state = await response.json()
      } catch (error) {
        this.error = error.message || 'Failed to start tournament.'
      } finally {
        this.loading = false
      }
    },
    strategyLabel (strategy) {
      if (strategy === 'wide_spread_v1') return 'Wide Spread'
      if (strategy === 'swiss_v1') return 'Swiss-Style'
      return 'Normal'
    },
    async logout () {
      await fetch('/api/score/logout', {
        method: 'POST',
        credentials: 'include'
      })
      this.authenticated = false
      this.state = null
      this.password = ''
      this.startMode = 'normal'
      window.dispatchEvent(new Event('score-auth-changed'))
    }
  },
  computed: {
    selectedModeLabel () {
      const match = this.state?.modes?.find((mode) => mode.id === this.startMode)
      return match?.label || 'Normal'
    }
  }
}
</script>

<style lang="scss">
.score-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 3rem;
  color: #eef0f2;
  background: radial-gradient(circle at 10% 10%, #1b2444 0%, #0f172a 45%, #080d19 100%);
}

.auth-panel,
.battle-panel {
  max-width: 70rem;
  margin: 0 auto;
}

.auth-panel form {
  display: grid;
  gap: 0.6rem;
  max-width: 24rem;
}

input {
  padding: 0.55rem 0.65rem;
  border-radius: 0.25rem;
  border: 1px solid #3a4b74;
  background: #0f1b36;
  color: #eef0f2;
}

button {
  padding: 0.55rem 0.8rem;
  border-radius: 0.25rem;
  border: 1px solid #5f82db;
  background: #2450c2;
  color: #ffffff;
  cursor: pointer;
}

.battle-header p {
  color: #9db0d4;
}

.battle-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.battle-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: stretch;
  justify-items: center;
}

.film-card {
  background: rgba(17, 27, 54, 0.75);
  border: 1px solid rgba(114, 140, 201, 0.3);
  border-radius: 0.35rem;
  padding: 0.65rem;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 0.6rem;
  width: 100%;
  max-width: 21.5rem;
}

.film-card img {
  width: 100%;
  max-width: 13.25rem;
  justify-self: center;
  border-radius: 0.25rem;
}

.poster-pick {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.poster-pick:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.film-title {
  font-size: 1rem;
  line-height: 1.35;
}

.draw-column {
  display: flex;
  align-items: center;
  justify-content: center;
}

.draw-btn {
  min-width: 6rem;
}

.start-panel {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(114, 140, 201, 0.35);
  border-radius: 0.35rem;
  background: rgba(17, 27, 54, 0.75);
}

.start-panel h2 {
  margin: 0 0 0.5rem;
}

.start-panel p {
  margin: 0 0 0.9rem;
  color: #9db0d4;
}

.mode-grid {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0.9rem;
}

.mode-option {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.55rem;
  row-gap: 0.2rem;
  align-items: start;
  padding: 0.55rem;
  border: 1px solid rgba(114, 140, 201, 0.35);
  border-radius: 0.3rem;
  background: rgba(10, 16, 34, 0.35);
}

.mode-option input {
  margin-top: 0.15rem;
}

.mode-title {
  font-weight: 600;
}

.mode-description {
  grid-column: 2;
  font-size: 0.9rem;
  color: #9db0d4;
}

.logout {
  background: transparent;
  border-color: #5a6887;
}

.error {
  margin-top: 0.8rem;
  color: #ff9a9a;
}

@media (max-width: 900px) {
  .score-page {
    padding: 0.9rem 0.5rem 1.4rem;
  }

  .battle-header-top {
    gap: 0.6rem;
  }

  .battle-header h1 {
    font-size: 1.15rem;
    margin: 0;
  }

  .battle-header p {
    font-size: 0.85rem;
    margin: 0.35rem 0 0;
  }

  .battle-grid {
    grid-template-columns: 1fr auto 1fr;
    gap: 0.35rem;
    align-items: center;
  }

  .film-card {
    max-width: none;
    padding: 0.35rem;
    gap: 0.3rem;
  }

  .film-title {
    font-size: 0.78rem;
    line-height: 1.15;
  }

  .film-card img {
    max-width: min(43vw, 8.6rem);
  }

  .draw-column {
    justify-content: center;
  }

  .draw-btn {
    min-width: 3.8rem;
    padding: 0.45rem 0.45rem;
    font-size: 0.78rem;
  }
}

@media (max-width: 420px) {
  .film-card img {
    max-width: min(42vw, 8rem);
  }
}
</style>
