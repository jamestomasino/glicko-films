<template>
  <div>
    <div id="skip">
      <a class="skip-main" href="#main">Skip to main content</a>
    </div>
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
      meta: [
        { hid: 'ogtitle', property: 'og:title', content: 'Tomasino Film Rankings' },
        { hid: 'twtitle', name: 'twitter:title', content: 'Tomasino Film Rankings' },
        { hid: 'googlename', itemprop: 'name', content: 'Tomasino Film Rankings' },
        { hid: 'description', name: 'description', content: 'A glicko2 algorithm powered ranking tool for personal film preferences' },
        { hid: 'ogdescription', property: 'og:description', content: 'A glicko2 algorithm powered ranking tool for personal film preferences' },
        { hid: 'twdescription', name: 'twitter:description', content: 'A glicko2 algorithm powered ranking tool for personal film preferences' },
        { hid: 'googledescription', itemprop: 'description', content: 'A glicko2 algorithm powered ranking tool for personal film preferences' },
        { hid: 'ogurl', property: 'og:url', content: 'https://films.tomasino.org' + this.$route.path },
        { hid: 'twsite', name: 'twitter:site', content: 'https://films.tomasino.org' + this.$route.path }
      ],
      link: [
        { hid: 'canonical', rel: 'canonical', href: 'https://films.tomasino.org' + this.$route.path }
      ],
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
