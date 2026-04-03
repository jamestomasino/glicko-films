# Tomasino Glicko-2 Film Rankings

Personal film-ranking app that seeds initial ratings from TMDb and then evolves rankings through head-to-head results using Glicko-style updates.

## Current State

- Runtime: Nuxt 2 static site + Netlify Functions
- Database: Netlify Neon Postgres + Drizzle schema/migrations
- Seed source: Trakt movie export (TV ignored)
- Image strategy: TMDb poster derivatives cached into Netlify Blobs (`thumb` and `cover`)
- Homepage: ranked film list with infinite scroll (100 at a time), position, thumbnail, title, TMDb link

## Completed

- [x] Repo + Netlify project linkage
- [x] Node 24 + npm migration
- [x] Neon database setup via Netlify
- [x] Drizzle schema and migrations in place
- [x] Trakt movie seed import completed
- [x] TMDb-based Elo/Glicko seed model applied to all films
- [x] Poster thumbnail/cover caching in Netlify Blobs
- [x] Public rankings homepage with infinite scroll
- [x] Password-protected scoring workflow + tournament match entry
- [x] Admin page for manual TMDb intake and film maintenance
- [x] Admin API endpoints for health, TMDb search, intake add, reseed, recache
- [x] Basic API guardrails: auth checks, rate limiting on private routes, and error logging
- [x] Lightweight API smoke test script

## Backlog

- [ ] Add re-sync utilities for incremental Trakt updates
- [ ] Add optional job queueing for long-running admin tasks
- [ ] Add alerting integration for production function errors

## Seeding Model

Initial rating is derived from TMDb vote average and vote count:

1. `w = clamp(log10(vote_count + 1) / 3, 0, 1)`
2. `adj = w * vote_average + (1 - w) * 6.5`
3. `elo_seed = clamp(round(1500 + 120 * (adj - 6.5)), 1200, 1800)`
4. `glicko_rating = elo_seed`
5. `glicko_rd = clamp(220 - 80 * w, 140, 220)`
6. `glicko_volatility = 0.06`

## Operational Scripts

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`
- `npm run seed:elo`
- `npm run cache:images`
- `npm run smoke:api` (requires local or deployed base URL reachable via `SMOKE_BASE_URL`)

For intake of a single new film, cache images immediately with one of:

- `npm run cache:images -- --film-id <film_id> --force`
- `npm run cache:images -- --tmdb-id <tmdb_id> --force`
