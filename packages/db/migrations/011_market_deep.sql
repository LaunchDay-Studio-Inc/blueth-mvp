-- Migration 011: Deep market system
--
-- Adds columns to npc_market_state for circuit breaker and NPC simulation.
-- Adds market_sessions table for vigor cost batching.
-- Adds spreads and alpha to npc_market_state.
-- NPC vendor uses account ID 5 (NPC_VENDOR) as a world money source/sink.

-- ============================================================
-- NPC_MARKET_STATE additions
-- ============================================================

-- alpha: price sensitivity per good (essentials 0.05-0.08, non-essentials 0.10-0.12)
ALTER TABLE npc_market_state
    ADD COLUMN alpha            NUMERIC(6,4) NOT NULL DEFAULT 0.10,
    ADD COLUMN spread_bps       INT          NOT NULL DEFAULT 200,     -- spread in basis points (200 = 2%)
    ADD COLUMN widened_spread_until TIMESTAMPTZ,                       -- post-halt widened spread window
    ADD COLUMN last_npc_refresh  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- MARKET_SESSIONS  (vigor cost batching per player)
--
-- If a player places multiple orders within 5 minutes, charge MV-4 once.
-- A new session starts after 5 minutes of inactivity.
-- ============================================================
CREATE TABLE market_sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_order_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vigor_charged   BOOLEAN     NOT NULL DEFAULT FALSE,
    order_count     INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_sessions_player
    ON market_sessions (player_id, last_order_at DESC);

-- ============================================================
-- DAY_TRADE_SESSIONS  (track for SpV-2 stress after 3+/day)
-- ============================================================
CREATE TABLE day_trade_sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    session_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
    count           INT         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (player_id, session_date)
);

-- ============================================================
-- SEED: Update alpha and spread for each good
-- Essentials: tighter spread, lower alpha
-- Non-essentials: wider spread, higher alpha
-- ============================================================

-- Essentials (alpha 0.05-0.08, spread 100-150 bps)
UPDATE npc_market_state SET alpha = 0.05, spread_bps = 100
WHERE good_id = (SELECT id FROM goods WHERE code = 'RAW_FOOD');

UPDATE npc_market_state SET alpha = 0.06, spread_bps = 120
WHERE good_id = (SELECT id FROM goods WHERE code = 'PROCESSED_FOOD');

UPDATE npc_market_state SET alpha = 0.05, spread_bps = 100
WHERE good_id = (SELECT id FROM goods WHERE code = 'FRESH_WATER');

UPDATE npc_market_state SET alpha = 0.08, spread_bps = 150
WHERE good_id = (SELECT id FROM goods WHERE code = 'ENERGY');

-- Non-essentials (alpha 0.10-0.12, spread 200-300 bps)
UPDATE npc_market_state SET alpha = 0.10, spread_bps = 200
WHERE good_id = (SELECT id FROM goods WHERE code = 'MATERIALS');

UPDATE npc_market_state SET alpha = 0.11, spread_bps = 250
WHERE good_id = (SELECT id FROM goods WHERE code = 'BUILDING_MATERIALS');

UPDATE npc_market_state SET alpha = 0.12, spread_bps = 300
WHERE good_id = (SELECT id FROM goods WHERE code = 'INDUSTRIAL_MACHINERY');

UPDATE npc_market_state SET alpha = 0.10, spread_bps = 200
WHERE good_id = (SELECT id FROM goods WHERE code = 'ENTERTAINMENT');

UPDATE npc_market_state SET alpha = 0.11, spread_bps = 250
WHERE good_id = (SELECT id FROM goods WHERE code = 'WASTE');
