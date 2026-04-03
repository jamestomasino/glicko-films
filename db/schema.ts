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
