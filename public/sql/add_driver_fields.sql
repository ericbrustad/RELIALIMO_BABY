-- =====================================================
-- SUPABASE MIGRATION: Ensure drivers table supports My Office driver UI
-- Run this in the Supabase SQL editor for the target project
-- =====================================================

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    contact_email TEXT,
    cell_phone TEXT,
    cell_phone_provider TEXT,
    home_phone TEXT,
    fax TEXT,
    other_phone TEXT,
    other_phone_provider TEXT,
    primary_address TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    address_zip TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'US',
    license_number TEXT,
    license_state TEXT,
    license_exp_date DATE,
    badge_id TEXT,
    badge_exp_date DATE,
    ssn TEXT,
    dob DATE,
    tlc_license_number TEXT,
    tlc_license_exp_date DATE,
    payroll_id TEXT,
    hire_date DATE,
    termination_date DATE,
    driver_level TEXT DEFAULT '0',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    type TEXT DEFAULT 'FULL TIME' CHECK (type IN ('FULL TIME', 'PART TIME')),
    is_vip BOOLEAN DEFAULT FALSE,
    suppress_auto_notifications BOOLEAN DEFAULT FALSE,
    show_call_email_dispatch BOOLEAN DEFAULT FALSE,
    quick_edit_dispatch BOOLEAN DEFAULT FALSE,
    include_phone_home BOOLEAN DEFAULT FALSE,
    include_phone_cell BOOLEAN DEFAULT FALSE,
    include_phone_other BOOLEAN DEFAULT FALSE,
    notify_email BOOLEAN DEFAULT FALSE,
    notify_fax BOOLEAN DEFAULT FALSE,
    notify_sms BOOLEAN DEFAULT FALSE,
    include_phone_1 TEXT,
    include_phone_2 TEXT,
    include_phone_3 TEXT,
    driver_alias TEXT,
    driver_group TEXT,
    assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatch_display_name TEXT,
    trip_sheets_display_name TEXT,
    driver_notes TEXT,
    web_username TEXT,
    web_password TEXT,
    web_access TEXT DEFAULT 'DENY' CHECK (web_access IN ('ALLOW', 'DENY')),
    trip_regular_rate NUMERIC(10, 2),
    trip_overtime_rate NUMERIC(10, 2),
    trip_double_time_rate NUMERIC(10, 2),
    travel_regular_rate NUMERIC(10, 2),
    travel_overtime_rate NUMERIC(10, 2),
    travel_double_time_rate NUMERIC(10, 2),
    passenger_regular_rate NUMERIC(10, 2),
    passenger_overtime_rate NUMERIC(10, 2),
    passenger_double_time_rate NUMERIC(10, 2),
    voucher_fee NUMERIC(10, 2),
    extra_nv_1 TEXT,
    extra_nv_2 TEXT,
    extra_nv_3 TEXT,
    extra_fl_1 TEXT,
    extra_fl_2 TEXT,
    extra_fl_3 TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, email),
    UNIQUE (organization_id, license_number)
);

DO $$
BEGIN
    -- Rename legacy TLC column if it is still present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license_number'
    ) THEN
        ALTER TABLE drivers RENAME COLUMN tlc_license TO tlc_license_number;
    END IF;

    -- Ensure all expected columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'contact_email') THEN
        ALTER TABLE drivers ADD COLUMN contact_email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'address_line2') THEN
        ALTER TABLE drivers ADD COLUMN address_line2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'country') THEN
        ALTER TABLE drivers ADD COLUMN country TEXT DEFAULT 'US';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'cell_phone_provider') THEN
        ALTER TABLE drivers ADD COLUMN cell_phone_provider TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'fax') THEN
        ALTER TABLE drivers ADD COLUMN fax TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'other_phone') THEN
        ALTER TABLE drivers ADD COLUMN other_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'other_phone_provider') THEN
        ALTER TABLE drivers ADD COLUMN other_phone_provider TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'notify_email') THEN
        ALTER TABLE drivers ADD COLUMN notify_email BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'notify_fax') THEN
        ALTER TABLE drivers ADD COLUMN notify_fax BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'notify_sms') THEN
        ALTER TABLE drivers ADD COLUMN notify_sms BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_1') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_1 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_2') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_3') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_3 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'suppress_auto_notifications') THEN
        ALTER TABLE drivers ADD COLUMN suppress_auto_notifications BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'show_call_email_dispatch') THEN
        ALTER TABLE drivers ADD COLUMN show_call_email_dispatch BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'quick_edit_dispatch') THEN
        ALTER TABLE drivers ADD COLUMN quick_edit_dispatch BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_home') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_home BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_cell') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_cell BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'include_phone_other') THEN
        ALTER TABLE drivers ADD COLUMN include_phone_other BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'badge_exp_date') THEN
        ALTER TABLE drivers ADD COLUMN badge_exp_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'tlc_license_exp_date') THEN
        ALTER TABLE drivers ADD COLUMN tlc_license_exp_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'payroll_id') THEN
        ALTER TABLE drivers ADD COLUMN payroll_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'is_vip') THEN
        ALTER TABLE drivers ADD COLUMN is_vip BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_alias') THEN
        ALTER TABLE drivers ADD COLUMN driver_alias TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_group') THEN
        ALTER TABLE drivers ADD COLUMN driver_group TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'assigned_vehicle_id') THEN
        ALTER TABLE drivers ADD COLUMN assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'dispatch_display_name') THEN
        ALTER TABLE drivers ADD COLUMN dispatch_display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'trip_sheets_display_name') THEN
        ALTER TABLE drivers ADD COLUMN trip_sheets_display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_notes') THEN
        ALTER TABLE drivers ADD COLUMN driver_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'web_username') THEN
        ALTER TABLE drivers ADD COLUMN web_username TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'web_password') THEN
        ALTER TABLE drivers ADD COLUMN web_password TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'trip_regular_rate') THEN
        ALTER TABLE drivers ADD COLUMN trip_regular_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'trip_overtime_rate') THEN
        ALTER TABLE drivers ADD COLUMN trip_overtime_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'trip_double_time_rate') THEN
        ALTER TABLE drivers ADD COLUMN trip_double_time_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'travel_regular_rate') THEN
        ALTER TABLE drivers ADD COLUMN travel_regular_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'travel_overtime_rate') THEN
        ALTER TABLE drivers ADD COLUMN travel_overtime_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'travel_double_time_rate') THEN
        ALTER TABLE drivers ADD COLUMN travel_double_time_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'passenger_regular_rate') THEN
        ALTER TABLE drivers ADD COLUMN passenger_regular_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'passenger_overtime_rate') THEN
        ALTER TABLE drivers ADD COLUMN passenger_overtime_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'passenger_double_time_rate') THEN
        ALTER TABLE drivers ADD COLUMN passenger_double_time_rate NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'voucher_fee') THEN
        ALTER TABLE drivers ADD COLUMN voucher_fee NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_nv_1') THEN
        ALTER TABLE drivers ADD COLUMN extra_nv_1 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_nv_2') THEN
        ALTER TABLE drivers ADD COLUMN extra_nv_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_nv_3') THEN
        ALTER TABLE drivers ADD COLUMN extra_nv_3 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_fl_1') THEN
        ALTER TABLE drivers ADD COLUMN extra_fl_1 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_fl_2') THEN
        ALTER TABLE drivers ADD COLUMN extra_fl_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'extra_fl_3') THEN
        ALTER TABLE drivers ADD COLUMN extra_fl_3 TEXT;
    END IF;

    -- Ensure default is in place for country (in case the column existed without one)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'country') THEN
        ALTER TABLE drivers ALTER COLUMN country SET DEFAULT 'US';
    END IF;
END $$;
