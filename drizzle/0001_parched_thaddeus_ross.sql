-- Step 1: Drop existing primary key constraints
ALTER TABLE "image_data" DROP CONSTRAINT "image_data_pkey";--> statement-breakpoint
ALTER TABLE "video_data" DROP CONSTRAINT "video_data_pkey";--> statement-breakpoint

-- Step 2: Add new columns to image_data (id as nullable first)
ALTER TABLE "image_data" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "model_used" text;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "generation_config" text;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "source_asset_ids" text[];--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "image_data" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

-- Step 3: Generate IDs for existing image_data records
UPDATE "image_data" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;--> statement-breakpoint

-- Step 4: Make id NOT NULL and add primary key
ALTER TABLE "image_data" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "image_data" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- Step 5: Migrate data from generation_info to image_data
UPDATE "image_data" AS id SET
  "prompt" = gi.prompt,
  "seed" = gi.seed,
  "model_used" = gi.model_used,
  "generation_config" = gi.generation_config,
  "source_asset_ids" = gi.source_asset_ids
FROM "generation_info" AS gi
WHERE id.asset_id = gi.asset_id;--> statement-breakpoint

-- Step 6: Add new columns to video_data (id as nullable first)
ALTER TABLE "video_data" ADD COLUMN "id" text;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "model_used" text;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "generation_config" text;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "source_asset_ids" text[];--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_data" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

-- Step 7: Generate IDs for existing video_data records
UPDATE "video_data" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;--> statement-breakpoint

-- Step 8: Make id NOT NULL and add primary key
ALTER TABLE "video_data" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_data" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- Step 9: Migrate data from generation_info to video_data
UPDATE "video_data" AS vd SET
  "prompt" = gi.prompt,
  "seed" = gi.seed,
  "model_used" = gi.model_used,
  "generation_config" = gi.generation_config,
  "source_asset_ids" = gi.source_asset_ids
FROM "generation_info" AS gi
WHERE vd.asset_id = gi.asset_id;--> statement-breakpoint

-- Step 10: Add new columns to job table
ALTER TABLE "job" ADD COLUMN "image_data_id" text;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "video_data_id" text;--> statement-breakpoint

-- Step 11: Migrate job associations (link to imageData/videoData by assetId)
UPDATE "job" AS j SET "image_data_id" = id.id
FROM "image_data" AS id
WHERE j.asset_id = id.asset_id
  AND j.type IN ('asset_image_generation', 'batch_image_generation');--> statement-breakpoint

UPDATE "job" AS j SET "video_data_id" = vd.id
FROM "video_data" AS vd
WHERE j.asset_id = vd.asset_id
  AND j.type = 'video_generation';--> statement-breakpoint

-- Step 12: Add foreign key constraints
ALTER TABLE "job" ADD CONSTRAINT "job_image_data_id_image_data_id_fk" FOREIGN KEY ("image_data_id") REFERENCES "public"."image_data"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_video_data_id_video_data_id_fk" FOREIGN KEY ("video_data_id") REFERENCES "public"."video_data"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Step 13: Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_image_data_asset_id" ON "image_data"("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_image_data_active" ON "image_data"("asset_id") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_video_data_asset_id" ON "video_data"("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_video_data_active" ON "video_data"("asset_id") WHERE "is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_image_data_id" ON "job"("image_data_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_video_data_id" ON "job"("video_data_id");
