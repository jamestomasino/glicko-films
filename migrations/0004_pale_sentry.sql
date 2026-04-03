CREATE TABLE "trakt_auth_state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trakt_auth_state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" varchar(32) DEFAULT 'primary' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" varchar(32),
	"scope" text,
	"created_at_epoch" integer,
	"expires_in" integer,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trakt_auth_state_key_unique" UNIQUE("key")
);
