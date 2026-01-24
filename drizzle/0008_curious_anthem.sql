CREATE TYPE "public"."asset_selection_status" AS ENUM('unrated', 'selected', 'rejected');--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "selection_status" "asset_selection_status" DEFAULT 'unrated' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_asset_selection_status" ON "asset" ("selection_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_asset_project_selection" ON "asset" ("project_id", "selection_status");