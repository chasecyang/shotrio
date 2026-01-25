ALTER TABLE "orders" RENAME COLUMN "creem_payment_id" TO "stripe_payment_intent_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "creem_session_id" TO "stripe_session_id";