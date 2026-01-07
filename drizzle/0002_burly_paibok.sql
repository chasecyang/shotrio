DROP TABLE "generation_info" CASCADE;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "model_used" text;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "generation_config" text;--> statement-breakpoint
ALTER TABLE "audio_data" ADD COLUMN "source_asset_ids" text[];