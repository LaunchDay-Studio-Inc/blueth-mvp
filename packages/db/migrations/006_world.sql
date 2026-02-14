-- Migration 006: World tables (districts, locations)
-- Also adds FK from businesses.district_code -> districts.code.

-- ============================================================
-- DISTRICTS
-- ============================================================
CREATE TABLE districts (
    code              TEXT         PRIMARY KEY,
    name              TEXT         NOT NULL,
    pricing_modifier  NUMERIC(5,2) NOT NULL DEFAULT 1.00
);

-- ============================================================
-- LOCATIONS  (places within a district where actions happen)
-- ============================================================
CREATE TABLE locations (
    district_code   TEXT  NOT NULL REFERENCES districts(code) ON DELETE CASCADE,
    location_code   TEXT  NOT NULL,
    name            TEXT  NOT NULL,
    actions_enabled JSONB NOT NULL DEFAULT '[]'::JSONB,

    PRIMARY KEY (district_code, location_code)
);

-- ============================================================
-- Add FK from businesses -> districts now that districts exists
-- ============================================================
ALTER TABLE businesses
    ADD CONSTRAINT fk_businesses_district
    FOREIGN KEY (district_code) REFERENCES districts(code);
