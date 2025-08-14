-- Drop unique constraint on mgmt_code if exists (allow duplicate 4-digit codes)
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

    -- Attempt to drop constraint names that may have been created
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Staff_mgmtCode_key') THEN
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT "Staff_mgmtCode_key";', staff_table);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_mgmt_code_key') THEN
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT staff_mgmt_code_key;', staff_table);
    END IF;
END $$;
