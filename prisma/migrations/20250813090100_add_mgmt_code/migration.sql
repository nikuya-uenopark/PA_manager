-- Robust migration: adds mgmt_code and Prisma-compatible unique constraint if missing.
DO $$
DECLARE
    staff_table TEXT := NULL;
BEGIN
    IF to_regclass('public."Staff"') IS NOT NULL THEN
        staff_table := '"Staff"';
    ELSIF to_regclass('public.staff') IS NOT NULL THEN
        staff_table := 'staff';
    ELSE
        RAISE EXCEPTION 'No staff table (Staff/staff) found';
    END IF;

    -- Add column if missing
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS mgmt_code VARCHAR(5);', staff_table);

    -- Add unique constraint compatible with Prisma's expected name
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('Staff_mgmtCode_key','staff_mgmt_code_key')
    ) THEN
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT "Staff_mgmtCode_key" UNIQUE (mgmt_code);', staff_table);
    END IF;
END $$;
