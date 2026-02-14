-- Migration 002: Double-entry ledger
--
-- DESIGN DECISION: player_wallets as explicit join table.
-- Each player gets exactly one BCE wallet (ledger_accounts row).
-- player_wallets maps player_id -> account_id for O(1) lookup.
-- System accounts (owner_type = 'system') handle sinks/sources:
--   e.g., "system:job_payroll", "system:tax", "system:market_escrow".
--
-- INVARIANT: SUM(credits) = SUM(debits) across all ledger_entries.
--   Every entry has a from_account (debit) and to_account (credit).
--   amount_cents is ALWAYS positive; direction conveyed by from/to.
--
-- Money is INTEGER CENTS. 1 BCE = 100 cents.
-- No floats. No NUMERIC for money. INT only.
-- Stored as INT (max ~21M BCE which is fine for MVP).

-- ============================================================
-- LEDGER_ACCOUNTS
-- ============================================================
CREATE TABLE ledger_accounts (
    id          BIGSERIAL PRIMARY KEY,
    owner_type  TEXT      NOT NULL CHECK (owner_type IN ('player','business','system','market')),
    owner_id    UUID,             -- NULL for system accounts
    currency    TEXT      NOT NULL DEFAULT 'BCE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLAYER_WALLETS  (convenience 1:1 mapping)
-- ============================================================
CREATE TABLE player_wallets (
    player_id   UUID   PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    account_id  BIGINT NOT NULL REFERENCES ledger_accounts(id)
);

-- ============================================================
-- LEDGER_ENTRIES  (immutable append-only log)
-- ============================================================
CREATE TABLE ledger_entries (
    id            BIGSERIAL   PRIMARY KEY,
    action_id     UUID,                                      -- nullable: ticks may not have an action
    from_account  BIGINT      NOT NULL REFERENCES ledger_accounts(id),
    to_account    BIGINT      NOT NULL REFERENCES ledger_accounts(id),
    amount_cents  INT         NOT NULL CHECK (amount_cents > 0),
    entry_type    TEXT        NOT NULL,                       -- e.g. 'job_pay','purchase','tax','bill'
    memo          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sanity: cannot transfer to self
    CHECK (from_account <> to_account)
);
