-- Initial schema for Blueth City MVP
-- Created: 2024-02-14

-- Users/Players table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Player state table
CREATE TABLE IF NOT EXISTS player_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Vigor dimensions (0-100)
    vigor_physical INT NOT NULL DEFAULT 100 CHECK (vigor_physical >= 0 AND vigor_physical <= 100),
    vigor_mental INT NOT NULL DEFAULT 100 CHECK (vigor_mental >= 0 AND vigor_mental <= 100),
    vigor_social INT NOT NULL DEFAULT 100 CHECK (vigor_social >= 0 AND vigor_social <= 100),
    vigor_creative INT NOT NULL DEFAULT 100 CHECK (vigor_creative >= 0 AND vigor_creative <= 100),
    vigor_spiritual INT NOT NULL DEFAULT 100 CHECK (vigor_spiritual >= 0 AND vigor_spiritual <= 100),

    -- Economy (money in cents)
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),

    -- Timestamps
    last_tick_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Actions log for idempotency
CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    payload JSONB,
    result JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_log_user_id ON action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_action_log_idempotency_key ON action_log(idempotency_key);

-- Market prices
CREATE TABLE IF NOT EXISTS market_prices (
    good_type VARCHAR(50) PRIMARY KEY,
    price INT NOT NULL CHECK (price > 0), -- in cents
    supply INT NOT NULL DEFAULT 0 CHECK (supply >= 0),
    demand INT NOT NULL DEFAULT 0 CHECK (demand >= 0),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial market prices
INSERT INTO market_prices (good_type, price, supply, demand) VALUES
    ('food', 500, 1000, 1000),
    ('housing', 50000, 100, 100),
    ('entertainment', 1000, 500, 500),
    ('tools', 5000, 200, 200),
    ('luxury', 20000, 50, 50)
ON CONFLICT (good_type) DO NOTHING;

-- Tick log for scheduler idempotency
CREATE TABLE IF NOT EXISTS tick_log (
    id SERIAL PRIMARY KEY,
    tick_type VARCHAR(50) NOT NULL,
    tick_time TIMESTAMP NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tick_type, tick_time)
);

CREATE INDEX IF NOT EXISTS idx_tick_log_type_time ON tick_log(tick_type, tick_time);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_state_updated_at BEFORE UPDATE ON player_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
