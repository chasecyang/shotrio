CREATE TYPE "public"."shot_video_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."message_role" ADD VALUE 'tool';--> statement-breakpoint
CREATE TABLE "shot_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"shot_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"label" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_video" (
	"id" text PRIMARY KEY NOT NULL,
	"shot_id" text NOT NULL,
	"generation_config" text NOT NULL,
	"video_url" text,
	"status" "shot_video_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shot" DROP CONSTRAINT "shot_image_asset_id_asset_id_fk";
--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."job_type";--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('batch_image_generation', 'asset_image_generation', 'script_element_extraction', 'video_generation', 'shot_video_generation', 'shot_tts_generation', 'final_video_export');--> statement-breakpoint
ALTER TABLE "job" ALTER COLUMN "type" SET DATA TYPE "public"."job_type" USING "type"::"public"."job_type";--> statement-breakpoint
ALTER TABLE "conversation_message" ADD COLUMN "tool_call_id" text;--> statement-breakpoint
ALTER TABLE "conversation_message" ADD COLUMN "tool_calls" text;--> statement-breakpoint
ALTER TABLE "shot" ADD COLUMN "current_video_id" text;--> statement-breakpoint
ALTER TABLE "shot_asset" ADD CONSTRAINT "shot_asset_shot_id_shot_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_asset" ADD CONSTRAINT "shot_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_video" ADD CONSTRAINT "shot_video_shot_id_shot_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."shot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "pending_action";--> statement-breakpoint
ALTER TABLE "conversation_message" DROP COLUMN "iterations";--> statement-breakpoint
ALTER TABLE "episode" DROP COLUMN "hook";--> statement-breakpoint
ALTER TABLE "shot" DROP COLUMN "video_url";--> statement-breakpoint
ALTER TABLE "shot" DROP COLUMN "image_asset_id";