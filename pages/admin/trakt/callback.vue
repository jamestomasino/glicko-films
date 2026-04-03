<template>
  <main class="callback-page">
    <section class="callback-panel">
      <h1>Trakt Callback</h1>
      <p>This endpoint is configured for Trakt OAuth redirects.</p>
      <p v-if="code">Received code: <code>{{ code }}</code></p>
      <p v-else-if="error">OAuth error: <code>{{ error }}</code></p>
      <p v-else>No authorization code was provided in the query string.</p>
      <nuxt-link to="/admin">Back to Admin</nuxt-link>
    </section>
  </main>
</template>

<script>
export default {
  name: 'AdminTraktCallbackPage',
  computed: {
    code () {
      return this.$route.query.code || ''
    },
    error () {
      return this.$route.query.error || ''
    }
  }
}
</script>

<style lang="scss">
.callback-page {
  min-height: 100vh;
  padding: 1.25rem 1rem 3rem;
  color: #eef0f2;
  background: radial-gradient(circle at 10% 10%, #1f2f5f 0%, #111827 50%, #0a0f1f 100%);
}

.callback-panel {
  max-width: 42rem;
  margin: 0 auto;
  border: 1px solid rgba(148, 166, 193, 0.35);
  border-radius: 0.4rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.72);
}

.callback-panel code {
  color: #c7ddff;
}

.callback-panel a {
  display: inline-block;
  margin-top: 0.8rem;
  color: #9dc5ff;
  text-decoration: none;
}
</style>
