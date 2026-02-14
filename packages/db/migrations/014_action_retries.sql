-- Migration 014: Add retry_count to actions table for dead letter behavior.
-- Actions that fail transiently are retried up to 3 times before being
-- permanently marked as 'failed'.

ALTER TABLE actions ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
