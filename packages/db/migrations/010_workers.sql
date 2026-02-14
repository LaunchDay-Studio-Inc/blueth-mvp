-- Migration 010: worker support (scheduler + ticks)

CREATE TABLE daily_summaries (
    summary_id       BIGSERIAL PRIMARY KEY,
    player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    summary_date     DATE        NOT NULL,
    tick_timestamp   TIMESTAMPTZ NOT NULL,
    summary          TEXT        NOT NULL,
    rent_cents       INT         NOT NULL DEFAULT 0,
    utilities_cents  INT         NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (player_id, summary_date)
);

CREATE INDEX idx_actions_due_for_scheduler
    ON actions (status, scheduled_for);

CREATE INDEX idx_ticks_claim
    ON ticks (tick_type, tick_timestamp, status);

CREATE INDEX idx_daily_summaries_player_date
    ON daily_summaries (player_id, summary_date DESC);
