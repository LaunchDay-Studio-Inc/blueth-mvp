-- Migration 010: Worker support tables + indexes
--
-- Adds:
--   daily_summaries table for end-of-day player summaries
--   Additional index for scheduler worker claiming

-- ============================================================
-- DAILY_SUMMARIES
-- One row per player per local-date, created at daily tick.
-- ============================================================
CREATE TABLE daily_summaries (
    id              BIGSERIAL   PRIMARY KEY,
    player_id       UUID        NOT NULL REFERENCES players(id),
    summary_date    DATE        NOT NULL,       -- local calendar date (player TZ)
    meals_eaten     INT         NOT NULL DEFAULT 0,
    shifts_worked   INT         NOT NULL DEFAULT 0,
    income_cents    INT         NOT NULL DEFAULT 0,
    expenses_cents  INT         NOT NULL DEFAULT 0,
    vigor_snapshot  JSONB,                       -- {pv, mv, sv, cv, spv} at midnight
    housing_tier    INT,
    penalties       JSONB,                       -- meal penalty detail
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (player_id, summary_date)
);

-- ============================================================
-- SCHEDULER WORKER INDEX
-- Hot path: claim due actions across all players
-- "SELECT ... WHERE status = 'scheduled'
--   AND scheduled_for + duration <= NOW()
--   ORDER BY scheduled_for LIMIT 50
--   FOR UPDATE SKIP LOCKED"
-- ============================================================
CREATE INDEX idx_actions_scheduler_due
    ON actions (status, scheduled_for)
    WHERE status = 'scheduled';

-- ============================================================
-- TICKS INDEX
-- Hot path: tick worker claims pending ticks
-- ============================================================
CREATE INDEX idx_ticks_status_type
    ON ticks (status, tick_type, tick_timestamp)
    WHERE status IN ('pending', 'running');
