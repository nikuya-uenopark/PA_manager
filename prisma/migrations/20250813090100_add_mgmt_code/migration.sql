-- Migration: add mgmt_code column to Staff
-- Safe for idempotent application; checks existence before altering
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "mgmt_code" VARCHAR(5);
-- Add unique constraint if not present
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'Staff' AND c.conname = 'Staff_mgmtCode_key'
    ) THEN
        ALTER TABLE "Staff" ADD CONSTRAINT "Staff_mgmtCode_key" UNIQUE ("mgmt_code");
    END IF;
END $$;
