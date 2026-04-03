CREATE TABLE "score_matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "score_matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tournament_id" integer NOT NULL,
	"film_low_id" integer NOT NULL,
	"film_high_id" integer NOT NULL,
	"score_low" real,
	"rated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_tournament_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "score_tournament_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tournament_id" integer NOT NULL,
	"film_id" integer NOT NULL,
	"start_rating" real NOT NULL,
	"start_rd" real NOT NULL,
	"start_volatility" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_tournaments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "score_tournaments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"strategy" varchar(32) DEFAULT 'similarity_v1' NOT NULL,
	"pool_size" integer DEFAULT 12 NOT NULL,
	"cooldown_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "score_matches" ADD CONSTRAINT "score_matches_tournament_id_score_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."score_tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_matches" ADD CONSTRAINT "score_matches_film_low_id_films_id_fk" FOREIGN KEY ("film_low_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_matches" ADD CONSTRAINT "score_matches_film_high_id_films_id_fk" FOREIGN KEY ("film_high_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_tournament_entries" ADD CONSTRAINT "score_tournament_entries_tournament_id_score_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."score_tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_tournament_entries" ADD CONSTRAINT "score_tournament_entries_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;