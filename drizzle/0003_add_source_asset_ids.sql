-- Replace sourceAssetId with sourceAssetIds array field in asset table
-- Drop old single source asset field
ALTER TABLE "asset" DROP COLUMN IF EXISTS "source_asset_id";

-- Add new multiple source assets field
ALTER TABLE "asset" ADD COLUMN "source_asset_ids" text[];

