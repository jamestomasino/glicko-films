<template>
  <div class="content">
    <h1>
      Tomasino Glicko2 Film Rankings
    </h1>
    <hr>
    <h2>
      TODO:
    </h2>
    <ul>
      <li>[x] Create repo</li>
      <li>[x] Connect to netlify</li>
      <li>[x] Connect to fauna database</li>
      <ul>
        <li>[ ] <a href="https://davidparks.dev/blog/building-a-like-counter-with-faunadb-and-nuxt/">Learn to use fauna</a></li>
        <li>[ ] Configure fauna database</li>
      </ul>
      <li>[ ] Connect to letterboxd API - (In private beta, may not be feasible)</li>
      <ul>
        <li>[ ] Fetch watchlist of user</li>
        <li>[ ] Parse fetched data to fill and append film list into fauna</li>
        <li>[ ] Estimate provisional Glicko2 ranking based on film stars on letterboxd</li>
        <li>[ ] Alternatively, export data from Letterboxd and process it into fauna from CLI</li>
      </ul>
      <li>[ ] Create a public list of all the films and their ranking</li>
      <li>[ ] Add an <a href="https://www.digitalcore.co.nz/login-dev-guides/01-build-a-login-system-with-nuxt-faunadb-and-netlify.html">auth mechanism</a> so we can rank and rate films but others can't</li>
      <li>[ ] Create film vs film match</li>
      <ul>
        <li>[ ] Front-end display of film vs film (can we fetch movie art?)</li>
        <li>[ ] Allow 1-0, 0-1, or 0.5-0.5 results</li>
      </ul>
      <li>[ ] Create tourney of matches (10-15 matches per film preferred) - Formula: N(N-1)/2</li>
      <ul>
        <li>[ ] Default every film matches against every other in tourney</li>
        <li>[ ] Add option for <a href="https://en.wikipedia.org/wiki/Swiss-system_tournament">Swiss-system tournaments</a></li>
        <li>[ ] Modify tourney to allow variable spread in Glicko2 pairings</li>
        <li>[ ] Weigh tourney selection inversely by tourney participation</li>
        <li>[ ] Update glicko2 ratings after tourney conclusion, not individual match</li>
      </ul>
    </ul>
  </div>
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
.content {
  display: flex;
  justify-content: center;
  align-items: center;
  display: block;
  background: rgb(2,0,36);
  background: linear-gradient(164deg, rgba(2,0,36,1) 0%, rgba(107,107,232,1) 35%, rgba(0,212,255,1) 100%);
  height: 100vh;
  color: white;
  padding: 20px;
  font-size: 18px;
  line-height: 22px;
}
h1 {
  margin-bottom: 2rem;
}
hr {
  margin-bottom: 2rem;
}
li {
  font-family: Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace;
}
a {
  color: #f8a6ff;
}
</style>
