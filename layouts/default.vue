<template>
  <div>
    <div id="skip">
      <a class="skip-main" href="#main">Skip to main content</a>
    </div>
    <nav class="site-nav" aria-label="Primary">
      <nuxt-link to="/" exact-active-class="is-active">Rankings</nuxt-link>
      <nuxt-link to="/score" exact-active-class="is-active">Scoring</nuxt-link>
      <nuxt-link to="/admin" exact-active-class="is-active">Admin</nuxt-link>
    </nav>
    <nuxt
      id="main"
      ref="main"
      aria-label="main"
      role="main"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

let bodyTag = null

export default {
  name: 'App',
  head () {
    return {
      title: 'Tomasino Film Rankings',
      bodyAttrs: {
        class: 'page-' + ((this.$route.path.length > 1) ? this.$route.path.slice(1).replace(/\/$/, '').replace(/\//g, '-') : 'home')
      }
    }
  },
  computed: {
    ...mapGetters('modals', ['isModalOpen'])
  },
  watch: {
    isModalOpen (val) {
      if (val) {
        bodyTag.classList.add('killscroll')
      } else {
        bodyTag.classList.remove('killscroll')
      }
    }
  },
  mounted () {
    bodyTag = document.getElementsByTagName('body')[0]
    bodyTag.classList.remove('killscroll')

    if (this.getParameterByName('screenshot')) {
      bodyTag.classList.add('screenshot')
    } else {
      bodyTag.classList.remove('screenshot')
    }

    if (this.$nuxt.$route.hash) {
      this.scrollToHash()
    }
  },
  methods: {
    scrollToHash () {
      const hash = this.$nuxt.$route.hash
      this.$nextTick(() => {
        this.$scrollTo(hash, 0, { offset: 0 })
      })
    },
    getParameterByName (name, url) {
      if (process.browser) {
        if (!url) {
          url = window.location.href
        }
        name = name.replace(/[[\]]/g, '\\$&')
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
        const results = regex.exec(url)
        if (!results) {
          return null
        }
        if (!results[2]) {
          return ''
        }
        return decodeURIComponent(results[2].replace(/\+/g, ' '))
      }
    }
  }
}
</script>

<style lang="scss">
.site-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  gap: 0.65rem;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(148, 166, 193, 0.25);
  background: rgba(7, 12, 23, 0.88);
  backdrop-filter: blur(6px);

  a {
    color: #c8d2e7;
    text-decoration: none;
    font-size: 0.92rem;
    line-height: 1;
    border: 1px solid rgba(94, 112, 146, 0.6);
    border-radius: 9999px;
    padding: 0.42rem 0.72rem;
  }

  a.is-active {
    color: #f8fbff;
    background: #2149b3;
    border-color: #6f90ec;
  }
}
</style>
