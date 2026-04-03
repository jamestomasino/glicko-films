ALTER TABLE "films" ADD COLUMN "tmdb_vote_average" real;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "tmdb_vote_count" integer;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "seed_adjusted_rating" real;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "seed_confidence" real;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "seed_model" varchar(64);--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "seeded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "elo_seed" integer;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "glicko_rating" real;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "glicko_rd" real;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "glicko_volatility" real;