-- 015_guest_tokens.sql
-- Bearer-token auth for itch.io / cross-origin guest sessions.

CREATE TABLE IF NOT EXISTS guest_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256 hex of raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guest_tokens_player ON guest_tokens (player_id);
CREATE INDEX idx_guest_tokens_hash   ON guest_tokens (token_hash, expires_at);
