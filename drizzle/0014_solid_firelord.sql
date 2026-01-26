ALTER TABLE "timeline" RENAME TO "cut";--> statement-breakpoint
ALTER TABLE "timeline_clip" RENAME TO "cut_clip";--> statement-breakpoint
ALTER TABLE "cut_clip" RENAME COLUMN "timeline_id" TO "cut_id";--> statement-breakpoint
ALTER TABLE "cut" DROP CONSTRAINT "timeline_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "cut" DROP CONSTRAINT "timeline_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "cut_clip" DROP CONSTRAINT "timeline_clip_timeline_id_timeline_id_fk";
--> statement-breakpoint
ALTER TABLE "cut_clip" DROP CONSTRAINT "timeline_clip_asset_id_asset_id_fk";
--> statement-breakpoint
ALTER TABLE "cut" ADD CONSTRAINT "cut_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cut" ADD CONSTRAINT "cut_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cut_clip" ADD CONSTRAINT "cut_clip_cut_id_cut_id_fk" FOREIGN KEY ("cut_id") REFERENCES "public"."cut"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cut_clip" ADD CONSTRAINT "cut_clip_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;