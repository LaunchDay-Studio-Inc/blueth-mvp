-- Migration 004: Market tables
--
-- NPC market uses a reference-price model with supply/demand curves.
-- Player-to-player trading uses a limit order book.
-- All prices are INTEGER CENTS. No floats.

-- ============================================================
-- NPC_MARKET_STATE  (one row per good)
-- ============================================================
CREATE TABLE npc_market_state (
    good_id                SMALLINT    PRIMARY KEY REFERENCES goods(id),
    demand                 NUMERIC(18,6) NOT NULL DEFAULT 0,
    supply                 NUMERIC(18,6) NOT NULL DEFAULT 0,
    ref_price_cents        INT         NOT NULL CHECK (ref_price_cents > 0),
    last_6h_ref_price_cents INT        NOT NULL CHECK (last_6h_ref_price_cents > 0),
    market_halt_until      TIMESTAMPTZ,  -- circuit-breaker for extreme swings
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_npc_market_state_updated_at
    BEFORE UPDATE ON npc_market_state
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MARKET_ORDERS  (limit order book)
-- ============================================================
CREATE TABLE market_orders (
    order_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type  TEXT          NOT NULL CHECK (actor_type IN ('player','business','npc')),
    actor_id    UUID,         -- NULL for system NPC orders
    good_id     SMALLINT      NOT NULL REFERENCES goods(id),
    side        TEXT          NOT NULL CHECK (side IN ('buy','sell')),
    order_type  TEXT          NOT NULL CHECK (order_type IN ('limit','market')),
    price_cents INT           CHECK (price_cents > 0 OR order_type = 'market'),
    qty_open    NUMERIC(18,6) NOT NULL CHECK (qty_open >= 0),
    qty_initial NUMERIC(18,6) NOT NULL CHECK (qty_initial > 0),
    status      TEXT          NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','partial','filled','cancelled')),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_market_orders_updated_at
    BEFORE UPDATE ON market_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MARKET_TRADES  (immutable trade log)
-- ============================================================
CREATE TABLE market_trades (
    trade_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    good_id       SMALLINT      NOT NULL REFERENCES goods(id),
    buy_order_id  UUID          NOT NULL REFERENCES market_orders(order_id),
    sell_order_id UUID          NOT NULL REFERENCES market_orders(order_id),
    price_cents   INT           NOT NULL CHECK (price_cents > 0),
    qty           NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    fee_cents     INT           NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
