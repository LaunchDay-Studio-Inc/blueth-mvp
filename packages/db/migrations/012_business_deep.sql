-- Migration 012: Business Deep — Schema updates for production engine.
--
-- Changes:
--   1. Alter business_workers.satisfaction from 0-100 scale to 0-1.3 scale
--   2. Add labor_hours and machinery_dep columns to recipes
--   3. Add result JSONB column to production_jobs
--   4. Add business_account_id to businesses (each business has its own ledger account)
--   5. Update seed recipe data with labor requirements and machinery depreciation
--   6. Add machinery_qty column to businesses for depreciation tracking
--   7. Add daily_location_rent_cents to businesses

-- ============================================================
-- 1. ALTER business_workers.satisfaction scale → [0, 1.3]
-- ============================================================
ALTER TABLE business_workers
    DROP CONSTRAINT IF EXISTS business_workers_satisfaction_check;

ALTER TABLE business_workers
    ALTER COLUMN satisfaction SET DEFAULT 1.00,
    ALTER COLUMN satisfaction TYPE NUMERIC(4,3);

ALTER TABLE business_workers
    ADD CONSTRAINT business_workers_satisfaction_check
    CHECK (satisfaction >= 0 AND satisfaction <= 1.3);

-- Update any existing rows from old 50.0 default to new 1.0 default
UPDATE business_workers SET satisfaction = 1.000 WHERE satisfaction > 1.3;

-- ============================================================
-- 2. ADD labor_hours and machinery_dep to recipes
-- ============================================================
ALTER TABLE recipes
    ADD COLUMN labor_hours     NUMERIC(6,2) NOT NULL DEFAULT 0,
    ADD COLUMN machinery_dep   NUMERIC(6,4) NOT NULL DEFAULT 0;

-- ============================================================
-- 3. ADD result JSONB to production_jobs
-- ============================================================
ALTER TABLE production_jobs
    ADD COLUMN result JSONB;

-- ============================================================
-- 4. ADD business ledger account + machinery tracking + rent
-- ============================================================
ALTER TABLE businesses
    ADD COLUMN account_id             INT,
    ADD COLUMN machinery_qty          NUMERIC(18,6) NOT NULL DEFAULT 0,
    ADD COLUMN daily_location_rent_cents INT NOT NULL DEFAULT 0;

-- ============================================================
-- 5. UPDATE seed recipe data with labor hours + machinery depreciation
-- ============================================================

-- PROCESS_FOOD: 2 worker-hours, 0.01 machinery dep
UPDATE recipes
   SET labor_hours = 2.0,
       machinery_dep = 0.01
 WHERE code = 'PROCESS_FOOD';

-- BUILD_MATERIALS: 3 worker-hours, 0.02 machinery dep
UPDATE recipes
   SET labor_hours = 3.0,
       machinery_dep = 0.02
 WHERE code = 'BUILD_MATERIALS';

-- ============================================================
-- 6. INDEX for production job tick queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_production_jobs_pending_finishes
    ON production_jobs (finishes_at)
    WHERE status = 'running';
