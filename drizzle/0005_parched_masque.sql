ALTER TABLE "job" DROP CONSTRAINT "job_parent_job_id_job_id_fk";
--> statement-breakpoint
ALTER TABLE "job" DROP COLUMN "parent_job_id";