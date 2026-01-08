-- 第1步：将列转为 text 类型
ALTER TABLE "job" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint

-- 第2步：更新现有数据，将旧的 enum 值映射到新的值
UPDATE "job" SET "type" = 'asset_image' WHERE "type" = 'asset_image_generation';--> statement-breakpoint
UPDATE "job" SET "type" = 'asset_video' WHERE "type" = 'video_generation';--> statement-breakpoint
UPDATE "job" SET "type" = 'asset_audio' WHERE "type" = 'audio_generation';--> statement-breakpoint

-- 第3步：删除旧的 enum 值
DELETE FROM "job" WHERE "type" = 'batch_image_generation';--> statement-breakpoint

-- 第4步：删除旧的 enum 类型
DROP TYPE "public"."job_type";--> statement-breakpoint

-- 第5步：创建新的 enum 类型
CREATE TYPE "public"."job_type" AS ENUM('asset_image', 'asset_video', 'asset_audio', 'final_video_export');--> statement-breakpoint

-- 第6步：将列转换回 enum 类型
ALTER TABLE "job" ALTER COLUMN "type" SET DATA TYPE "public"."job_type" USING "type"::"public"."job_type";
