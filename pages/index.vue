<template>
  <main class="rankings-page">
    <header class="page-header">
      <h1>Tomasino Film Rankings</h1>
      <p>Ordered by current rating. Showing {{ films.length }} of {{ total || '...' }} films.</p>
    </header>

    <ol class="film-list">
      <li
        v-for="film in films"
        :key="film.id"
        class="film-row"
      >
        <span class="position">{{ film.position }}</span>
        <a
          v-if="film.tmdbUrl"
          class="poster-link"
          :href="film.tmdbUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`Open ${film.title} on TMDb`"
        >
          <img
            v-if="film.thumbnailUrl"
            class="poster"
            :src="film.thumbnailUrl"
            :alt="`${film.title} poster`"
            loading="lazy"
            decoding="async"
          >
          <div
            v-else
            class="poster-fallback"
            aria-hidden="true"
          />
        </a>
        <div
          v-else
          class="poster-fallback"
          aria-hidden="true"
        />

        <div class="film-meta">
          <div class="title">{{ film.title }}</div>
          <div
            v-if="film.year"
            class="year"
          >
            {{ film.year }}
          </div>
        </div>
      </li>
    </ol>

    <div
      ref="sentinel"
      class="sentinel"
      aria-hidden="true"
    />

    <p
      v-if="loading"
      class="status"
    >
      Loading more films...
    </p>
    <p
      v-else-if="error"
      class="status status-error"
    >
      {{ error }}
    </p>
    <p
      v-else-if="!hasMore && films.length > 0"
      class="status"
    >
      End of list.
    </p>
  </main>
</template>

<script>
export default {
  name: 'HomePage',
  data () {
    return {
      films: [],
      total: 0,
      offset: 0,
      limit: 100,
      loading: false,
      hasMore: true,
      error: '',
      observer: null
    }
  },
  head () {
    return {
      title: 'Tomasino Film Rankings',
      meta: [
        { hid: 'ogtitle', property: 'og:title', content: 'Tomasino Film Rankings' },
        { hid: 'twtitle', name: 'twitter:title', content: 'Tomasino Film Rankings' },
        { hid: 'googlename', itemprop: 'name', content: 'Tomasino Film Rankings' },
        { hid: 'description', name: 'description', content: 'Personal film rankings with infinite scroll and TMDb links.' },
        { hid: 'ogdescription', property: 'og:description', content: 'Personal film rankings with infinite scroll and TMDb links.' },
        { hid: 'twdescription', name: 'twitter:description', content: 'Personal film rankings with infinite scroll and TMDb links.' },
        { hid: 'googledescription', itemprop: 'description', content: 'Personal film rankings with infinite scroll and TMDb links.' },
        { hid: 'ogurl', property: 'og:url', content: 'https://films.tomasino.org' + this.$route.path },
        { hid: 'twsite', name: 'twitter:site', content: 'https://films.tomasino.org' + this.$route.path }
      ],
      link: [
        { hid: 'canonical', rel: 'canonical', href: 'https://films.tomasino.org' + this.$route.path }
      ]
    }
  },
  async mounted () {
    await this.fetchNextPage()
    this.setupInfiniteScroll()
  },
  beforeDestroy () {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  },
  methods: {
    async fetchNextPage () {
      if (this.loading || !this.hasMore) return

      this.loading = true
      this.error = ''

      try {
        const response = await fetch(`/api/films?offset=${this.offset}&limit=${this.limit}`)
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`)
        }

        const payload = await response.json()
        const items = Array.isArray(payload.items) ? payload.items : []

        this.films = this.films.concat(items)
        this.offset += items.length
        this.total = Number(payload.total) || this.total
        this.hasMore = Boolean(payload.hasMore)
      } catch (err) {
        this.error = 'Could not load films right now.'
        this.hasMore = false
      } finally {
        this.loading = false
      }
    },
    setupInfiniteScroll () {
      if (!window.IntersectionObserver || !this.$refs.sentinel) return

      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.fetchNextPage()
        }
      }, {
        rootMargin: '600px 0px'
      })

      this.observer.observe(this.$refs.sentinel)
    }
  }
}
</script>

<style lang="scss">
.rankings-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 3rem;
  color: #eef0f2;
  background: radial-gradient(circle at 10% 10%, #11353f 0%, #0a1720 40%, #060d12 100%);
}

.page-header {
  max-width: 60rem;
  margin: 0 auto 1.5rem;

  h1 {
    margin: 0 0 0.4rem;
    font-size: clamp(1.6rem, 3.6vw, 2.3rem);
    line-height: 1.1;
  }

  p {
    margin: 0;
    color: #9eb6c0;
    font-size: 0.95rem;
  }
}

.film-list {
  max-width: 60rem;
  margin: 0 auto;
  padding: 0;
  list-style: none;
}

.film-row {
  display: grid;
  grid-template-columns: 3.5rem 4rem 1fr;
  gap: 0.85rem;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid rgba(158, 182, 192, 0.16);
}

.position {
  display: inline-flex;
  justify-content: flex-end;
  color: #7eb4c2;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.poster-link {
  display: inline-block;
  width: 100%;
  max-width: 4rem;
}

.poster {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.25rem;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}

.poster-fallback {
  width: 4rem;
  height: 6rem;
  border-radius: 0.25rem;
  background: linear-gradient(145deg, #3a4a53, #222f36);
}

.film-meta {
  min-width: 0;
}

.title {
  font-size: 1rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.year {
  margin-top: 0.15rem;
  color: #93a9b3;
  font-size: 0.85rem;
}

.sentinel {
  height: 1px;
}

.status {
  max-width: 60rem;
  margin: 1.2rem auto 0;
  color: #9eb6c0;
  font-size: 0.92rem;
}

.status-error {
  color: #ff8f8f;
}

@media (max-width: 640px) {
  .film-row {
    grid-template-columns: 2.8rem 3.4rem 1fr;
    gap: 0.65rem;
  }

  .poster-link,
  .poster-fallback {
    max-width: 3.4rem;
    width: 3.4rem;
    height: auto;
  }

  .poster-fallback {
    height: 5.1rem;
  }

  .title {
    font-size: 0.95rem;
  }
}
</style>
