-- Migration 008: Performance indexes
--
-- Created based on expected query patterns:
--   - Action dispatch: find pending/scheduled actions for a player
--   - Ledger queries: balance calculation, audit trail
--   - Market matching: order book queries by good/side/price
--   - Trade history: recent trades per good
--   - Production: find running jobs for a business
--   - Tick dedup: already handled by UNIQUE on ticks table

-- ============================================================
-- ACTIONS
-- Hot path: "get pending actions for player, ordered by scheduled time"
-- ============================================================
CREATE INDEX idx_actions_player_status_scheduled
    ON actions (player_id, status, scheduled_for)
    WHERE status IN ('pending', 'scheduled', 'running');

-- ============================================================
-- LEDGER_ENTRIES
-- Hot path: "calculate balance for account" = SUM credits - SUM debits
-- Hot path: "get all entries for an action" (audit trail)
-- ============================================================
CREATE INDEX idx_ledger_entries_action
    ON ledger_entries (action_id)
    WHERE action_id IS NOT NULL;

CREATE INDEX idx_ledger_entries_from_account
    ON ledger_entries (from_account, created_at);

CREATE INDEX idx_ledger_entries_to_account
    ON ledger_entries (to_account, created_at);

-- ============================================================
-- MARKET_ORDERS
-- Hot path: order matching engine scans open orders by good+side+price
-- Buy side: ORDER BY price_cents DESC (highest bid first)
-- Sell side: ORDER BY price_cents ASC  (lowest ask first)
-- ============================================================
CREATE INDEX idx_market_orders_book
    ON market_orders (good_id, side, status, price_cents)
    WHERE status IN ('open', 'partial');

-- ============================================================
-- MARKET_TRADES
-- Hot path: "recent trade history for good" (price discovery)
-- ============================================================
CREATE INDEX idx_market_trades_good_time
    ON market_trades (good_id, created_at DESC);

-- ============================================================
-- PRODUCTION_JOBS
-- Hot path: "find jobs that should finish now" (tick worker)
-- ============================================================
CREATE INDEX idx_production_jobs_status_finishes
    ON production_jobs (status, finishes_at)
    WHERE status IN ('pending', 'running');

-- ============================================================
-- BUSINESSES
-- Hot path: "get all businesses for a player"
-- ============================================================
CREATE INDEX idx_businesses_owner
    ON businesses (owner_player_id);

-- ============================================================
-- BUSINESS_WORKERS
-- Hot path: "get all workers for a business"
-- ============================================================
CREATE INDEX idx_business_workers_business
    ON business_workers (business_id);

-- ============================================================
-- INVENTORIES
-- Hot path: "get all inventory for an owner"
-- Primary key already covers (owner_type, owner_id, good_id).
-- Add index for "find all holders of a specific good" if needed.
-- ============================================================
CREATE INDEX idx_inventories_good
    ON inventories (good_id);

-- ============================================================
-- PLAYER_WALLETS
-- account_id lookup for ledger joins
-- ============================================================
CREATE INDEX idx_player_wallets_account
    ON player_wallets (account_id);
