CREATE TABLE "superlative_votes" (
	"pool_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superlative_votes_pool_id_voter_id_category_key_pk" PRIMARY KEY("pool_id","voter_id","category_key")
);
