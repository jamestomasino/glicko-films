# nuxt-template

> A template to start Nuxt projects, loaded with all the additional modules that are used in almost all of our projects.
## Server Setup

- create a ubuntu 18.04 vm
- create user `web`
- add `web` to groups `sudo` and `www-data`
- log in as `web` and secure ssh
- add ssh pubkeys to `web` user for deployment access
- create ssh key as web user
- use web user's pubkey as deploy key in project repository
- clone repo into `~/serva` and `~/servb` with ssh
- symlink `Makefile` and `ecosystem.config.js` to home folder
- install the latest node-js (not apt, look this up)
- install git-lfs
- install pm2 globally
- install ufw and allow ssh, http, and https, then enable
- install nginx
- configure vhosts for testing (use sample conf in repo, probably to dummy url for now)
- install certbot (reconfigure later when DNS is ready for real prod)
- `make production` && `make stage`
- `pm2 startup` && `pm2 save` - to return the server to working order on reboot
- check that backups are enabled and any alerts are configured on the vm
- add to up/down detection
