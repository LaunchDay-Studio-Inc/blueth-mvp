-- ============================================================
-- Migration 013: Anomaly Logging
--
-- Tracks suspicious or notable events for admin review:
--   - Excessive money delta per day
--   - Order spam exceeding N/min
--   - Repeated failed actions
-- ============================================================

CREATE TABLE IF NOT EXISTS anomalies (
  id            BIGSERIAL       PRIMARY KEY,
  player_id     UUID            NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type          TEXT            NOT NULL,       -- e.g. 'money_spike', 'order_spam', 'repeated_failures'
  detail        JSONB           NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomalies_player      ON anomalies (player_id);
CREATE INDEX idx_anomalies_type        ON anomalies (type);
CREATE INDEX idx_anomalies_created_at  ON anomalies (created_at DESC);

-- Composite index for per-player-per-type lookups (e.g. recent anomalies of a given type)
CREATE INDEX idx_anomalies_player_type ON anomalies (player_id, type, created_at DESC);

COMMENT ON TABLE anomalies IS
  'Anomaly log for unusual player activity. Written by background detection jobs and inline checks.';
