import {
  bigint,
  date,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core'

export const films = pgTable('films', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  traktId: integer('trakt_id').notNull().unique(),
  tmdbId: integer('tmdb_id'),
  imdbId: varchar('imdb_id', { length: 20 }),
  traktSlug: varchar('trakt_slug', { length: 255 }),
  title: varchar({ length: 255 }).notNull(),
  year: integer(),
  overview: text().notNull().default(''),
  runtime: integer(),
  releasedOn: date('released_on'),
  posterUrl: text('poster_url'),
  backdropUrl: text('backdrop_url'),
  traktRating: real('trakt_rating'),
  traktVotes: integer('trakt_votes'),
  tmdbVoteAverage: real('tmdb_vote_average'),
  tmdbVoteCount: integer('tmdb_vote_count'),
  tmdbPosterPath: text('tmdb_poster_path'),
  tmdbBackdropPath: text('tmdb_backdrop_path'),
  seedAdjustedRating: real('seed_adjusted_rating'),
  seedConfidence: real('seed_confidence'),
  seedModel: varchar('seed_model', { length: 64 }),
  seededAt: timestamp('seeded_at', { withTimezone: true }),
  posterThumbBlobKey: text('poster_thumb_blob_key'),
  posterCoverBlobKey: text('poster_cover_blob_key'),
  posterCachedAt: timestamp('poster_cached_at', { withTimezone: true }),
  eloSeed: integer('elo_seed'),
  glickoRating: real('glicko_rating'),
  glickoRd: real('glicko_rd'),
  glickoVolatility: real('glicko_volatility'),
  plays: integer().notNull().default(0),
  lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }),
  userRating: integer('user_rating'),
  userRatedAt: timestamp('user_rated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const filmWatchEvents = pgTable('film_watch_events', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  filmId: integer('film_id').notNull().references(() => films.id, { onDelete: 'cascade' }),
  traktHistoryId: bigint('trakt_history_id', { mode: 'number' }).notNull().unique(),
  watchedAt: timestamp('watched_at', { withTimezone: true }).notNull(),
  action: varchar({ length: 32 }),
  source: varchar({ length: 32 }).notNull().default('trakt_export'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const scoreTournaments = pgTable('score_tournaments', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  status: varchar({ length: 24 }).notNull().default('active'),
  strategy: varchar({ length: 32 }).notNull().default('similarity_v1'),
  poolSize: integer('pool_size').notNull().default(12),
  cooldownDays: integer('cooldown_days').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  appliedAt: timestamp('applied_at', { withTimezone: true })
})

export const scoreTournamentEntries = pgTable('score_tournament_entries', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tournamentId: integer('tournament_id').notNull().references(() => scoreTournaments.id, { onDelete: 'cascade' }),
  filmId: integer('film_id').notNull().references(() => films.id, { onDelete: 'cascade' }),
  startRating: real('start_rating').notNull(),
  startRd: real('start_rd').notNull(),
  startVolatility: real('start_volatility').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const scoreMatches = pgTable('score_matches', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tournamentId: integer('tournament_id').notNull().references(() => scoreTournaments.id, { onDelete: 'cascade' }),
  filmLowId: integer('film_low_id').notNull().references(() => films.id, { onDelete: 'cascade' }),
  filmHighId: integer('film_high_id').notNull().references(() => films.id, { onDelete: 'cascade' }),
  scoreLow: real('score_low'),
  ratedAt: timestamp('rated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
