-- Migration 001: Core tables
-- players, player_state, actions, ticks
-- Also creates the shared updated_at trigger function.

-- ============================================================
-- UTILITY: auto-update updated_at on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE players (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    timezone        TEXT         NOT NULL DEFAULT 'Asia/Dubai',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLAYER_STATE
-- Vigor stored as integers 0-100.
-- Caps stored as integers; default cap per dimension = 100.
-- ============================================================
CREATE TABLE player_state (
    player_id           UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,

    -- Vigor dimensions (PV = Physical Vigor, etc.)
    pv                  INT NOT NULL DEFAULT 100 CHECK (pv >= 0),
    mv                  INT NOT NULL DEFAULT 100 CHECK (mv >= 0),
    sv                  INT NOT NULL DEFAULT 100 CHECK (sv >= 0),
    cv                  INT NOT NULL DEFAULT 100 CHECK (cv >= 0),
    spv                 INT NOT NULL DEFAULT 100 CHECK (spv >= 0),

    -- Vigor caps (soft-capped; may temporarily exceed via buffs)
    pv_cap              INT NOT NULL DEFAULT 100 CHECK (pv_cap > 0),
    mv_cap              INT NOT NULL DEFAULT 100 CHECK (mv_cap > 0),
    sv_cap              INT NOT NULL DEFAULT 100 CHECK (sv_cap > 0),
    cv_cap              INT NOT NULL DEFAULT 100 CHECK (cv_cap > 0),
    spv_cap             INT NOT NULL DEFAULT 100 CHECK (spv_cap > 0),

    -- Sleep / recovery state
    sleep_state         TEXT NOT NULL DEFAULT 'awake'
                        CHECK (sleep_state IN ('awake', 'sleeping', 'exhausted')),

    -- Housing tier affects regen rate; 0 = homeless
    housing_tier        INT NOT NULL DEFAULT 0 CHECK (housing_tier >= 0),

    -- Meal tracking for food-penalty cascade
    last_meal_times     JSONB NOT NULL DEFAULT '[]'::JSONB,
    meal_day_count      INT   NOT NULL DEFAULT 0 CHECK (meal_day_count >= 0),
    meal_penalty_level  INT   NOT NULL DEFAULT 0 CHECK (meal_penalty_level >= 0),

    -- Used by daily-tick to avoid double-reset
    last_daily_reset    DATE,

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_player_state_updated_at
    BEFORE UPDATE ON player_state
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ACTIONS  (exactly-once via idempotency_key)
-- ============================================================
CREATE TABLE actions (
    action_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    type             TEXT        NOT NULL,
    payload          JSONB,
    status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','scheduled','running','completed','failed','cancelled')),
    scheduled_for    TIMESTAMPTZ,
    duration_seconds INT,
    idempotency_key  TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    failure_reason   TEXT,
    result           JSONB,

    UNIQUE (player_id, idempotency_key)
);

-- ============================================================
-- TICKS  (scheduler idempotency)
-- ============================================================
CREATE TABLE ticks (
    tick_id         BIGSERIAL   PRIMARY KEY,
    tick_type       TEXT        NOT NULL,
    tick_timestamp  TIMESTAMPTZ NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    detail          JSONB,

    UNIQUE (tick_type, tick_timestamp)
);
