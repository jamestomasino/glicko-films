# Tomasino Film Rankings

Personal movie-ranking app that uses head-to-head matchups and Elo/Glicko-style rating updates to keep a living leaderboard of films.

## What It Does

- Publishes a public rankings page with infinite scroll.
- Stores each film with TMDb metadata and cached poster images.
- Lets you run private scoring tournaments to compare films head-to-head.
- Updates film ratings over time based on matchup outcomes.
- Provides a private admin area for intake, maintenance, and Trakt sync operations.

## How Ranking Works

1. Films are seeded with a starting Elo/Glicko rating derived from TMDb vote average and vote count.
2. Scoring happens through tournaments with head-to-head matchups.
3. You pick left, right, or draw.
4. Ratings shift based on expected vs actual outcomes.
5. Repeated tournaments continuously refine the leaderboard.

## Core Pages

- `/` Public ranked film list.
- `/about` Project explanation.
- `/score` Auth-protected scoring workflow.
- `/admin` Auth-protected operations and integrations.

## Integrations

- **TMDb** for canonical movie metadata and poster paths.
- **Trakt** for watched-movie history sync (movies only).
- **Netlify Blobs** for persistent poster thumbnail/cover caching.
- **Netlify Neon Postgres** for films, watch history, auth state, scoring state, and admin jobs.

## Runtime Architecture

- Frontend: React + Vite SPA.
- Backend: Netlify Functions (API and scheduled workers).
- Database access: `@netlify/neon`.
- Schema/migrations: Drizzle.
- Scheduled processing: Netlify scheduled function for queued admin jobs.

## Data + Jobs

Main tables include:

- `films`
- `film_watch_events`
- `score_tournaments`
- `score_tournament_entries`
- `score_matches`
- `trakt_auth_state`
- `trakt_sync_state`
- `admin_jobs`

The queue processes long-running admin work (for example Trakt sync) without blocking UI actions.

## Authentication + Security

- Admin and scoring routes require the score session cookie.
- Private write endpoints require explicit write intent headers.
- Private endpoints are rate-limited.

## Environment Variables

Required/commonly used values:

- `NETLIFY_DATABASE_URL`
- `TMDB_API_ACCESS_TOKEN`
- `SCORE_PASSWORD`
- `SCORE_SESSION_SECRET`
- `TRAKT_CLIENT_ID`
- `TRAKT_CLIENT_SECRET`
- `TRAKT_REDIRECT_URI`

Optional:

- `TRAKT_OAUTH_STATE_SECRET`
- `TRAKT_SYNC_MAX_PAGES` (default `10`)
- `TRAKT_SYNC_PAGE_SIZE` (default `100`, max `100`)
- `TRAKT_HTTP_USER_AGENT`
- `JOB_SCHEDULED_BATCH_LIMIT` (default `3`)
- `JOB_SCHEDULED_SECRET` (required to authorize scheduled job execution)
- `ALERT_WEBHOOK_URL`

### Secret Generation

Generate high-entropy secrets with:

- `openssl rand -hex 32`

Use unique generated values (do not reuse the same one) for:

- `SCORE_SESSION_SECRET`
- `TRAKT_OAUTH_STATE_SECRET`
- `JOB_SCHEDULED_SECRET`

And keep them unique per environment (dev/staging/prod).

## Scripts

- `npm run dev` Start local frontend.
- `npm run build` Build production frontend.
- `npm run start` Preview built frontend.
- `npm run db:generate` Generate Drizzle migration.
- `npm run db:migrate` Apply migrations (via Netlify env context).
- `npm run db:studio` Open Drizzle Studio.
- `npm run seed:elo` Seed/reseed ratings from TMDb model.
- `npm run cache:images` Cache posters to Netlify Blobs.
- `npm run smoke:api` Run API smoke checks.
