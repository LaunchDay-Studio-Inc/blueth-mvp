-- Migration 009: Auth sessions + player_state extensions for action engine
--
-- Adds:
--   1. sessions table for DB-backed httpOnly cookie auth
--   2. active_buffs JSONB on player_state (vigor buff tracking)
--   3. skills JSONB on player_state (economy skill progression)

-- ============================================================
-- SESSIONS
-- ============================================================

CREATE TABLE sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_player
    ON sessions (player_id);

CREATE INDEX idx_sessions_active
    ON sessions (id, expires_at);

-- ============================================================
-- PLAYER_STATE EXTENSIONS
-- ============================================================

-- Active buffs (vigor system: meal, leisure, social_call buffs)
-- Stored as JSON array of Buff objects matching @blueth/core Buff type
ALTER TABLE player_state
    ADD COLUMN active_buffs JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Skills (economy system: labor, admin, service, management, trading)
-- Default matches defaultSkillSet() in @blueth/core/economy
ALTER TABLE player_state
    ADD COLUMN skills JSONB NOT NULL
    DEFAULT '{"labor":0.1,"admin":0.1,"service":0.1,"management":0.1,"trading":0.1}'::JSONB;
