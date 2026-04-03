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
        <h1>Head-to-Head Scoring</h1>
        <p>Tournament #{{ state?.tournament?.id }} · {{ state?.pendingCount }} matches remaining</p>
      </header>

      <div
        v-if="state?.matchup"
        class="battle-grid"
      >
        <article class="film-card">
          <img
            v-if="state.matchup.leftFilm.coverUrl"
            :src="state.matchup.leftFilm.coverUrl"
            :alt="`${state.matchup.leftFilm.title} poster`"
          >
          <div class="film-title">
            {{ state.matchup.leftFilm.title }} <span v-if="state.matchup.leftFilm.year">({{ state.matchup.leftFilm.year }})</span>
          </div>
          <button
            :disabled="loading"
            @click="submit('left')"
          >
            Left Wins
          </button>
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
          <img
            v-if="state.matchup.rightFilm.coverUrl"
            :src="state.matchup.rightFilm.coverUrl"
            :alt="`${state.matchup.rightFilm.title} poster`"
          >
          <div class="film-title">
            {{ state.matchup.rightFilm.title }} <span v-if="state.matchup.rightFilm.year">({{ state.matchup.rightFilm.year }})</span>
          </div>
          <button
            :disabled="loading"
            @click="submit('right')"
          >
            Right Wins
          </button>
        </article>
      </div>

      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>
      <button
        class="logout"
        :disabled="loading"
        @click="logout"
      >
        Logout
      </button>
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
    async logout () {
      await fetch('/api/score/logout', {
        method: 'POST',
        credentials: 'include'
      })
      this.authenticated = false
      this.state = null
      this.password = ''
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

.battle-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: stretch;
}

.film-card {
  background: rgba(17, 27, 54, 0.75);
  border: 1px solid rgba(114, 140, 201, 0.3);
  border-radius: 0.35rem;
  padding: 0.65rem;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 0.6rem;
}

.film-card img {
  width: 100%;
  border-radius: 0.25rem;
}

.film-title {
  font-size: 1rem;
  line-height: 1.35;
}

.draw-column {
  display: grid;
  align-items: center;
}

.draw-btn {
  min-width: 6rem;
}

.logout {
  margin-top: 1rem;
  background: transparent;
  border-color: #5a6887;
}

.error {
  margin-top: 0.8rem;
  color: #ff9a9a;
}

@media (max-width: 900px) {
  .battle-grid {
    grid-template-columns: 1fr;
  }

  .draw-column {
    justify-content: center;
  }
}
</style>
