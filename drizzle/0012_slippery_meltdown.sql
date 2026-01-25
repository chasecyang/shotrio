CREATE TABLE "example_asset" (
	"asset_id" text PRIMARY KEY NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"display_name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_asset" ADD CONSTRAINT "example_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;