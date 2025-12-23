-- Migration: Add context field to conversation table
-- Date: 2025-01-XX
-- Description: 
--   Add context field to store complete AgentContext (selectedEpisodeId, selectedShotIds, etc.)
--   This allows conversations to be resumed with full context information

-- Add context column
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "context" TEXT;

-- Note: Existing conversations will have NULL context, which is fine
-- New conversations will store the full context when created

