<template>
  <h1>
    Hello World!
  </h1>
</template>

<script>
export default {
  name: 'HomePage',
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
        { hid: 'ogurl', property: 'og:url', content: 'https://www.domain.com' + this.$route.path },
        { hid: 'twsite', name: 'twitter:site', content: 'https://www.domain.com' + this.$route.path }
      ],
      link: [
        { hid: 'canonical', rel: 'canonical', href: 'https://www.domain.com' + this.$route.path }
      ]
    }
  }
}
</script>
<style lang="scss">
h1 {
  display: block;
  background: rgb(2,0,36);
  background: linear-gradient(164deg, rgba(2,0,36,1) 0%, rgba(107,107,232,1) 35%, rgba(0,212,255,1) 100%);
  height: 100vh;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
