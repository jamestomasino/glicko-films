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
    <GlobalISI>
      <h2>
        IMPORTANT SAFETY INFORMATION
      </h2>
      <p>
        <strong>Indication for Use</strong>
      </p>
      <p>
        <Brand /> is a brand that treats a medical condition.
      </p>
      <p>
        <strong>Contraindication</strong>
      </p>
      <p>
        <Brand /> is contraindicated in the presence of clinically important elements.
      </p>
      <p>
        <strong>Warnings &amp; Precautions</strong>
      </p>
      <ul>
        <li><Brand /> is intended for single use only. <strong>Do not</strong> reuse, resterilize, reprocess, or use if primary packaging has been opened or damaged. Discard after use.</li>
      </ul>
      <p>
        <strong>Storage &amp; Handling:</strong>
        Store between -95°C and +90°C and keep away from direct sunlight and high humidity.
      </p>
      <p>
        <em>You are encouraged to report adverse events related to <Brand /> by calling <a href="tel:18882579676">1 (888) 257-9676</a>. If you prefer, you may contact the U.S. Food and Drug Administration (FDA) directly.
          Visit <strong><a href="http://www.fda.gov/MedWatch">http://www.fda.gov/MedWatch</a></strong> or call <a href="tel:18003321088">1-800-FDA-1088</a>.</em>
      </p>
    </GlobalISI>
    <GlobalModalExit />
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

let bodyTag = null

export default {
  name: 'App',
  head () {
    return {
      title: '',
      meta: [
        { hid: 'ogtitle', property: 'og:title', content: '' },
        { hid: 'twtitle', name: 'twitter:title', content: '' },
        { hid: 'googlename', itemprop: 'name', content: '' },
        { hid: 'description', name: 'description', content: '' },
        { hid: 'ogdescription', property: 'og:description', content: '' },
        { hid: 'twdescription', name: 'twitter:description', content: '' },
        { hid: 'googledescription', itemprop: 'description', content: '' },
        { hid: 'ogurl', property: 'og:url', content: 'https://www.domain.com/' + this.$route.path },
        { hid: 'twsite', name: 'twitter:site', content: 'https://www.domain.com/' + this.$route.path }
      ],
      link: [
        { hid: 'canonical', rel: 'canonical', href: 'https://www.domain.com/' + this.$route.path }
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
