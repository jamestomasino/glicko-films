<template>
  <div class="content">
    <h1>
      Tomasino Glicko-2 Film Rankings
    </h1>
    <hr>
    <p>
      This site is designed to showcase my watched films list, ranking them from best to worst using the <a href="https://en.wikipedia.org/wiki/Glicko_rating_system">Glicko-2 Rating System</a>. It is an ELO-like system commonly used to rank chess players. This site is an experiment designed to apply that system to my film reviews.
    </p>
    <p>
      To perform these rankings a small number of participants from my wached-films list will be selected for a "ranking tournament". These 10-15 films will be set head-to-head against one another in matches where I will indicate if I prefer one over the other, or whether they tie. Over the course of a tournament each film will compare against each of the others and at the conclusion their rankings will update. Over time these tournaments will sort and reveal my preferences and the rankings will take shape with increasing confidence.
    </p>
    <p>
      The process for this ranking system involves a lot of head-to-head matches before the list reaches a reliable threshhold. As such, it is unlikely to appeal to others for their own personal use. I've decided to keep this site for my personal use only as a result. If you are interested in replicating it, though, all of the code is open source.
    </p>
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
        <li>[ ] Estimate provisional Glicko-2 ranking based on film stars on letterboxd</li>
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
        <li>[ ] Modify tourney to allow variable spread in Glicko-2 pairings</li>
        <li>[ ] Weigh tourney selection inversely by tourney participation</li>
        <li>[ ] Update Glicko-2 ratings after tourney conclusion, not individual match</li>
      </ul>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'HomePage',
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
      ]
    }
  }
}
</script>
<style lang="scss">
.content {
  position: static;
  display: flex;
  justify-content: center;
  align-items: center;
  display: block;
  background: rgb(2,0,36);
  background: linear-gradient(104deg, rgba(2,0,36,1) 0%, rgba(64,9,121,1) 35%, rgba(12,98,101,1) 100%);
  height: 100vh;
  color: white;
  padding: 20px;
  font-size: 18px;
  line-height: 22px;
  overflow: scroll;
}
h1 {
  margin-bottom: 2rem;
  font-size: 36px;
  line-height: 40px;
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
p {
  max-width: 80rem;
  margin-bottom: 1rem;
}
</style>
