module.exports = {
  apps : [
    {
      name      : 'serva',
      script    : 'npm',
      args      : 'start',
      cwd       : '/home/web/serva',
      env: {
        PORT: 3000,
        NUXT_PORT: 3000,
        NODE_ENV: 'production'
      },
      watch: false,
      cron_restart: '0 5 * * *',
      max_memory_restart: '850M'
    },
    {
      name      : 'servb',
      script    : 'npm',
      args      : 'start',
      cwd       : '/home/web/servb',
      env: {
        PORT: 4000,
        NUXT_PORT: 4000,
        NODE_ENV: 'production'
      },
      watch: false,
      cron_restart: '0 5 * * *',
      max_memory_restart: '850M'
    },
  ],

  deploy : {
    serva : {
      user : 'web',
      host : 'localhost',
      ref  : 'origin/master',
      repo : '',
      path : '/home/web/serva',
      'post-deploy' : 'npm install && npm run build && pm2 startOrRestart'
    },
    servb : {
      user : 'web',
      host : 'localhost',
      ref  : 'origin/master',
      repo : '',
      path : '/home/web/servb-b',
      'post-deploy' : 'npm install && npm run build && pm2 startOrRestart'
    }
  }
}
