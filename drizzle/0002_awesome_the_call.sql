ALTER TABLE "brackets" ADD COLUMN "autofilled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_predictions" ADD COLUMN "pens_winner" text;