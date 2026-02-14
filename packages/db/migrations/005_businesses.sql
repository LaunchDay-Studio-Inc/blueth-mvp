-- Migration 005: Businesses, workers, recipes, production
--
-- Businesses are player-owned entities that produce goods.
-- Workers are NPCs hired for a wage (integer cents/day).
-- Recipes define input/output transformations.

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    district_code   TEXT NOT NULL,   -- FK added after districts table exists (migration 006)
    location_code   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUSINESS_WORKERS  (NPC employees)
-- ============================================================
CREATE TABLE business_workers (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    npc_id        UUID,   -- references future NPC table; nullable for now
    wage_cents    INT     NOT NULL CHECK (wage_cents >= 0),
    satisfaction  NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (satisfaction >= 0 AND satisfaction <= 100),
    hours_per_day INT     NOT NULL DEFAULT 8 CHECK (hours_per_day > 0 AND hours_per_day <= 24),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_business_workers_updated_at
    BEFORE UPDATE ON business_workers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE recipes (
    id               SMALLSERIAL PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    duration_seconds INT  NOT NULL CHECK (duration_seconds > 0)
);

-- ============================================================
-- RECIPE_INPUTS  (what a recipe consumes)
-- ============================================================
CREATE TABLE recipe_inputs (
    recipe_id SMALLINT      NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    good_id   SMALLINT      NOT NULL REFERENCES goods(id),
    qty       NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    PRIMARY KEY (recipe_id, good_id)
);

-- ============================================================
-- RECIPE_OUTPUTS  (what a recipe produces)
-- ============================================================
CREATE TABLE recipe_outputs (
    recipe_id SMALLINT      NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    good_id   SMALLINT      NOT NULL REFERENCES goods(id),
    qty       NUMERIC(18,6) NOT NULL CHECK (qty > 0),
    PRIMARY KEY (recipe_id, good_id)
);

-- ============================================================
-- PRODUCTION_JOBS  (in-progress recipe executions)
-- ============================================================
CREATE TABLE production_jobs (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID      NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    recipe_id   SMALLINT  NOT NULL REFERENCES recipes(id),
    status      TEXT      NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed','cancelled')),
    started_at  TIMESTAMPTZ,
    finishes_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
