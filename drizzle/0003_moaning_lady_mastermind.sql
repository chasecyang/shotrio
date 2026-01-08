CREATE TABLE "project_template" (
	"project_id" text PRIMARY KEY NOT NULL,
	"video_url" text,
	"thumbnail" text,
	"category" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_template" ADD CONSTRAINT "project_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;