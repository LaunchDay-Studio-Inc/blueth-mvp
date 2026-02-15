-- Migration 016: Fund escrow and materialized balance
--
-- Bug #26: Add escrowed_cents to market_orders for buy-side fund reservation.
--   Buy limit orders now escrow funds at placement (player → MARKET_ESCROW).
--   Fills draw from escrow. Cancellation refunds remaining escrow.
--
-- Bug #28: Add balance_cents to ledger_accounts for O(1) balance reads.
--   Replaces the O(N) SUM(CASE...) query over ledger_entries.
--   Maintained atomically by transferCents().

-- ── Bug #26: Fund escrow ─────────────────────────────────────

ALTER TABLE market_orders ADD COLUMN escrowed_cents BIGINT NOT NULL DEFAULT 0;

-- ── Bug #28: Materialized balance ────────────────────────────

ALTER TABLE ledger_accounts ADD COLUMN balance_cents BIGINT NOT NULL DEFAULT 0;

-- Backfill existing balances from ledger entries
UPDATE ledger_accounts la
SET balance_cents = COALESCE((
  SELECT SUM(
    CASE
      WHEN to_account = la.id THEN amount_cents
      WHEN from_account = la.id THEN -amount_cents
      ELSE 0
    END
  )
  FROM ledger_entries
  WHERE from_account = la.id OR to_account = la.id
), 0);
