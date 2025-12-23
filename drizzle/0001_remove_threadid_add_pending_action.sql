-- Migration: Remove threadId unique constraint and add pendingAction field
-- Date: 2025-12-23
-- Description: 
--   1. Remove threadId unique constraint (causing index size error)
--   2. Add pendingAction field to store pending user confirmations
--   3. Keep threadId temporarily for backward compatibility (will be removed later)

-- Step 1: Drop the unique constraint on threadId
ALTER TABLE "conversation" DROP CONSTRAINT IF EXISTS "conversation_thread_id_unique";

-- Step 2: Add pendingAction column
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "pending_action" TEXT;

-- Step 3: Migrate existing pendingAction data from threadId to new column (if needed)
-- This is a best-effort migration - extract pendingAction from JSON if it exists
UPDATE "conversation"
SET "pending_action" = (
  CASE 
    WHEN "thread_id" IS NOT NULL AND "thread_id"::jsonb ? 'pendingAction'
    THEN ("thread_id"::jsonb -> 'pendingAction')::text
    ELSE NULL
  END
)
WHERE "thread_id" IS NOT NULL;

-- Note: threadId column is kept for now to avoid data loss
-- It will be removed in a future migration after verifying the new system works

