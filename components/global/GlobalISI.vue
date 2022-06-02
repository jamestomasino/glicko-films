<template>
  <section
    id="important-safety-information"
    ref="isi"
    :class="{ fixed: fixed, fullscreen: showISI, shrink: shrink }"
    class="white-bg"
  >
    <div
      ref="isiwrapper"
      class="isi-wrapper"
    >
      <div class="container1">
        <div
          class="isi-see-more"
        >
          <span class="isi-see-more-text">
            <span
              class="view-all"
              @click="toggleISI();"
            >
              View all
            </span>
            <span
              class="collapse"
              @click="toggleISI();"
            >
              View less
            </span>
          </span>
        </div>
        <div class="isi-container">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
export default {
  name: 'GlobalISI',
  data () {
    return {
      fixed: false,
      shrink: false,
      shrinkPoint: 50
    }
  },
  computed: {
    ...mapGetters('modals', ['showISI'])
  },
  watch: {
    showISI (val) {
      this.$refs.isiwrapper.scrollTop = 0
    },
    $route () {
      // force a recalculation on route change since dom changed
      setTimeout(this.loop, 200)
    }
  },
  mounted () {
    if (!this.getParameterByName('screenshot')) {
      this.$addScrollListener(this.loop)
      this.loop() // force one on load
    }
  },
  beforeUnmount () {
    this.$removeScrollListener(this.loop)
  },
  methods: {
    ...mapMutations('modals', ['toggleISI']),
    loop () {
      if (process.browser) {
        const y = window.pageYOffset
        const h = Math.max(
          document.documentElement.clientHeight,
          window.innerHeight || 0
        )
        const bodyRect = document.body.getBoundingClientRect()
        const isi = this.$refs.isi
        if (isi) {
          const elemRect = isi.getBoundingClientRect()
          const offset = elemRect.top - bodyRect.top
          if (y > offset - h * 0.8) {
            this.fixed = false
          } else {
            this.fixed = true
          }
          if (y > this.shrinkPoint) {
            this.shrink = true
          } else {
            this.shrink = false
          }
        }
      }
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
<style lang='scss'>
#important-safety-information {
  position: relative;
  z-index: 8;
  padding-bottom: 40px;
  padding-top: 40px;
  background-color: white;

  .isi-wrapper {
    position: relative;
    background-color: white;

    .isi-container {
      position: relative;
      margin-bottom: 0;
      padding: 10px 5% 0 5%;
      z-index: 1;
      width: 100%;
      max-width: 1500px;
      margin: 0 auto;

      p {
        margin-bottom: 15px;
      }
    }
  }

  &.fixed.fullscreen {
    z-index: 11;

    .isi-wrapper {
      height: 100vh;
      height: calc(var(--vh, 1vh) * 100); /* vh.js */
      margin: 0;
      width: 100%;
      max-width: none;
      left: 0;
      overflow: auto;
      padding-bottom: 50px;

      .isi-container {
        max-width: 1300px;
        margin: 0 auto;
      }

      .isi-see-more {
        background: rgba(250, 250, 250, 1);
        padding: 5px;
        position: fixed;
        right: 20px;
        height: 23px;
        line-height: 12px;
        opacity: 0;
        animation-duration: 0.7s;
        animation-delay: 0.7s;
        animation-name: fadeInFromNone;
        animation-fill-mode: forwards;

        .view-all {
          display: none;
        }

        .collapse {
          display: block;
        }
      }
    }
  }

  &.fixed {
    margin-bottom: 200px;

    &.shrink:not(.fullscreen) {
      .isi-wrapper {
        height: 45px;
      }
    }

    .isi-wrapper {
      box-shadow: 0 -8px 60px rgba(228, 228, 228, 0.84);
      position: fixed;
      bottom: 0;
      left: 0;
      height: 180px;
      z-index: 9;
      transition: height 0.7s cubic-bezier(0.23, 1, 0.32, 1);
      overflow: hidden;

      .isi-see-more {
        font-weight: bold;
        color: black;
        font-size: 11px;
        line-height: 15px;
        text-align: right;
        display: block;
        position: absolute;
        top: 12px;
        right: 15px;
        height: 31px;
        background-size: 100%;
        cursor: pointer;
        z-index: 5;
        text-transform: uppercase;

        .view-all {
          display: block;
        }

        .collapse {
          display: none;
        }
      }
    }
  }

  &:not(.fullscreen).fixed {
    .isi-container {
      /* padding: 8px 20px 0 20px; */

      .isi-head {
        display: block;
      }

      .isi-inline-hide {
        display: none;
      }

      .isi-inline-show {
        display: inline;
      }
    }
  }

  .isi-see-more {
    display: none;
  }
}

.error {
  #information-safety-information {
    background-color: white;
    &.shrink:not(.fixed) {
      .isi-wrapper {
        background-color: white;
      }
    }
  }
}

/* Small devices (tablets, 768px and up) */
@media (min-width: 768px) {
  #important-safety-information {
    &.fixed {
      .isi-wrapper {
        height: 160px;

        .isi-see-more {
          right: 20px;
        }
      }

      &.isi-shrink:not(.fullscreen) {
        .isi-wrapper {
          height: 77px;
        }
      }
    }
    .isi-wrapper {
      .isi-container {
        p {
          font-size: 17px;
          line-height: 19px;
          margin-bottom: 22px;

          &.isi-header {
            font-size: 24px;
            line-height: 30px;
          }

          &.isi-subheader {
            font-size: 18px;
            line-height: 22px;
          }

          &.list-title {
            font-size: 17px;
            line-height: 19px;
          }
        }
      }
    }
  }
}

@keyframes fadeInFromNone {
  0% {
    opacity: 0;
  }

  1% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}

@-webkit-keyframes fadeInFromNone {
  0% {
    opacity: 0;
  }

  1% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}

/* Medium devices (desktops, 992px and up) */
@media (min-width: 992px) {
  #important-safety-information {
    &.fixed {
      .isi-wrapper {
        height: 170px;
      }

      &.isi-shrink:not(.fullscreen) {
        .isi-wrapper {
          height: 70px;
        }
      }
    }
    .isi-wrapper {
      .isi-container {
        p {
          margin-bottom: 15px;

          &.isi-header {
            margin-bottom: 15px;
          }

          &.isi-subheader {
            margin-bottom: 15px;
          }
        }

        ul {
          margin-bottom: 15px;

          li {
            font-size: 17px;
            line-height: 19px;
          }
        }
      }
    }
  }
}

/* Large devices (large desktops, 1200px and up) */
@media (min-width: 1200px) {
  #important-safety-information {
    &.fixed {
      .isi-wrapper {
        height: 170px;
        background-color: white;
      }
      &.isi-shrink:not(.fullscreen) {
        .isi-wrapper {
          height: 52px;
        }
      }
    }
  }
}

@media (min-width: 1400px) {
  #important-safety-information {
    &.fixed {
      .isi-wrapper {
        width: 100%;
      }
    }
  }
}
</style>
