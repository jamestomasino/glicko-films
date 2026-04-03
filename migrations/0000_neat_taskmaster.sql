CREATE TABLE "film_watch_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "film_watch_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"film_id" integer NOT NULL,
	"trakt_history_id" bigint NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	"action" varchar(32),
	"source" varchar(32) DEFAULT 'trakt_export' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "film_watch_events_trakt_history_id_unique" UNIQUE("trakt_history_id")
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "films_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"trakt_id" integer NOT NULL,
	"tmdb_id" integer,
	"imdb_id" varchar(20),
	"trakt_slug" varchar(255),
	"title" varchar(255) NOT NULL,
	"year" integer,
	"overview" text DEFAULT '' NOT NULL,
	"runtime" integer,
	"released_on" date,
	"poster_url" text,
	"backdrop_url" text,
	"trakt_rating" real,
	"trakt_votes" integer,
	"plays" integer DEFAULT 0 NOT NULL,
	"last_watched_at" timestamp with time zone,
	"user_rating" integer,
	"user_rated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "films_trakt_id_unique" UNIQUE("trakt_id")
);
--> statement-breakpoint
ALTER TABLE "film_watch_events" ADD CONSTRAINT "film_watch_events_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;