-- Drop old primary key constraint
ALTER TABLE "audio_data" DROP CONSTRAINT "audio_data_pkey";--> statement-breakpoint
-- Add new id column (nullable first)
ALTER TABLE "audio_data" ADD COLUMN "id" text;--> statement-breakpoint
-- Generate UUIDs for existing records
UPDATE "audio_data" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;--> statement-breakpoint
-- Make id NOT NULL and set as primary key
ALTER TABLE "audio_data" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_data" ADD PRIMARY KEY ("id");--> statement-breakpoint
-- Add version control columns
ALTER TABLE "audio_data" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;