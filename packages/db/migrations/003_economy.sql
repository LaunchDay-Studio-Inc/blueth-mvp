-- Migration 003: Goods & Inventories
--
-- Goods are a small fixed catalog; smallserial PK.
-- Inventories use fractional qty (NUMERIC(18,6)) because
-- production recipes output fractional units and decay is fractional.
-- MONEY is never stored here — only physical quantities.

-- ============================================================
-- GOODS
-- ============================================================
CREATE TABLE goods (
    id           SMALLSERIAL PRIMARY KEY,
    code         TEXT    NOT NULL UNIQUE,
    name         TEXT    NOT NULL,
    is_essential BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- INVENTORIES
-- Polymorphic owner: ('player', player_uuid), ('business', biz_uuid), ('market', NULL)
-- ============================================================
CREATE TABLE inventories (
    owner_type  TEXT          NOT NULL CHECK (owner_type IN ('player','business','market','system')),
    owner_id    UUID,         -- NULL for system/market sinks
    good_id     SMALLINT      NOT NULL REFERENCES goods(id),
    qty         NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (qty >= 0),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    PRIMARY KEY (owner_type, owner_id, good_id)
);

CREATE TRIGGER trg_inventories_updated_at
    BEFORE UPDATE ON inventories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
