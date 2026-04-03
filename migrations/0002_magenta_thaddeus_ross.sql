ALTER TABLE "films" ADD COLUMN "tmdb_poster_path" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "tmdb_backdrop_path" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "poster_thumb_blob_key" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "poster_cover_blob_key" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "poster_cached_at" timestamp with time zone;