-- =====================================================
-- SUPABASE MIGRATION: Vehicle types and fleet tables
-- Run this in the Supabase SQL editor for the target project
-- =====================================================

-- Vehicle Types ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    pricing_basis TEXT DEFAULT 'HOURS' CHECK (pricing_basis IN ('HOURS', 'MILES', 'DAYS')),
    passenger_capacity INTEGER,
    luggage_capacity INTEGER,
    color_hex TEXT,
    service_type_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    accessible BOOLEAN DEFAULT FALSE,
    hide_from_online BOOLEAN DEFAULT FALSE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    -- Ensure new columns exist when the table pre-dates this migration
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'code') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'pricing_basis') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN pricing_basis TEXT DEFAULT 'HOURS';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'passenger_capacity') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN passenger_capacity INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'luggage_capacity') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN luggage_capacity INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'color_hex') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN color_hex TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'service_type_tags') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN service_type_tags TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'accessible') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN accessible BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'hide_from_online') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN hide_from_online BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'description') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'sort_order') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicle_types' AND column_name = 'metadata') THEN
        ALTER TABLE public.vehicle_types ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vehicle_types'
          AND column_name = 'pricing_basis'
    ) THEN
        ALTER TABLE public.vehicle_types ALTER COLUMN pricing_basis SET DEFAULT 'HOURS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_types_status_check_old'
    ) THEN
        ALTER TABLE public.vehicle_types DROP CONSTRAINT vehicle_types_status_check_old;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_types_status_check'
    ) THEN
        ALTER TABLE public.vehicle_types
        ADD CONSTRAINT vehicle_types_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_types_pricing_basis_check'
    ) THEN
        ALTER TABLE public.vehicle_types
        ADD CONSTRAINT vehicle_types_pricing_basis_check CHECK (pricing_basis IN ('HOURS', 'MILES', 'DAYS'));
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_types_org_name_key'
    ) THEN
        ALTER TABLE public.vehicle_types
        DROP CONSTRAINT vehicle_types_org_name_key;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicle_types_org_code_key'
    ) THEN
        ALTER TABLE public.vehicle_types
        DROP CONSTRAINT vehicle_types_org_code_key;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS vehicle_types_org_idx ON public.vehicle_types (organization_id);
CREATE INDEX IF NOT EXISTS vehicle_types_sort_idx ON public.vehicle_types (organization_id, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_types_org_name_idx
    ON public.vehicle_types (organization_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_types_org_code_idx
    ON public.vehicle_types (organization_id, LOWER(code))
    WHERE code IS NOT NULL;

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- Vehicle Type Images ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_type_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    vehicle_type_id UUID NOT NULL REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    display_name TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicle_type_images_vehicle_idx ON public.vehicle_type_images (vehicle_type_id);
CREATE INDEX IF NOT EXISTS vehicle_type_images_org_idx ON public.vehicle_type_images (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_type_images_primary_idx
    ON public.vehicle_type_images (vehicle_type_id)
    WHERE is_primary;

ALTER TABLE public.vehicle_type_images ENABLE ROW LEVEL SECURITY;

-- Vehicle Type Rate Matrices ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_type_rate_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    vehicle_type_id UUID NOT NULL REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
    rate_type TEXT NOT NULL CHECK (rate_type IN ('PER_HOUR', 'PER_PASSENGER', 'DISTANCE')),
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT DEFAULT 'USD',
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicle_type_rate_matrices_vehicle_idx ON public.vehicle_type_rate_matrices (vehicle_type_id);
CREATE INDEX IF NOT EXISTS vehicle_type_rate_matrices_org_idx ON public.vehicle_type_rate_matrices (organization_id);

ALTER TABLE public.vehicle_type_rate_matrices ENABLE ROW LEVEL SECURITY;

-- Vehicle Type Rate Entries ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_type_rate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_matrix_id UUID NOT NULL REFERENCES public.vehicle_type_rate_matrices(id) ON DELETE CASCADE,
    from_quantity NUMERIC(10, 2),
    to_quantity NUMERIC(10, 2),
    rate NUMERIC(12, 2) NOT NULL,
    unit TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicle_type_rate_entries_matrix_idx ON public.vehicle_type_rate_entries (rate_matrix_id, sort_order);

ALTER TABLE public.vehicle_type_rate_entries ENABLE ROW LEVEL SECURITY;

-- Vehicle Type Peak Rates ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_type_peak_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_matrix_id UUID NOT NULL REFERENCES public.vehicle_type_rate_matrices(id) ON DELETE CASCADE,
    weekday SMALLINT CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME,
    end_time TIME,
    multiplier NUMERIC(8, 3),
    flat_adjustment NUMERIC(12, 2),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicle_type_peak_rates_matrix_idx ON public.vehicle_type_peak_rates (rate_matrix_id, weekday);

ALTER TABLE public.vehicle_type_peak_rates ENABLE ROW LEVEL SECURITY;

-- Vehicles (Fleet) -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
    unit_number TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    make TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    passenger_capacity INTEGER,
    vin TEXT,
    license_plate TEXT,
    registration_expires_on DATE,
    insurance_expires_on DATE,
    insurance_company TEXT,
    insurance_policy_number TEXT,
    insurance_contact TEXT,
    current_mileage INTEGER,
    next_service_mileage INTEGER,
    last_service_on DATE,
    next_service_on DATE,
    service_notes TEXT,
    garage_location TEXT,
    assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
    internal_notes TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    -- Add vehicle columns if the table existed previously
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'vehicle_type_id') THEN
        ALTER TABLE public.vehicles ADD COLUMN vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'unit_number') THEN
        ALTER TABLE public.vehicles ADD COLUMN unit_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'status') THEN
        ALTER TABLE public.vehicles ADD COLUMN status TEXT DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'color') THEN
        ALTER TABLE public.vehicles ADD COLUMN color TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'passenger_capacity') THEN
        ALTER TABLE public.vehicles ADD COLUMN passenger_capacity INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'registration_expires_on') THEN
        ALTER TABLE public.vehicles ADD COLUMN registration_expires_on DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'insurance_expires_on') THEN
        ALTER TABLE public.vehicles ADD COLUMN insurance_expires_on DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'insurance_company') THEN
        ALTER TABLE public.vehicles ADD COLUMN insurance_company TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'insurance_policy_number') THEN
        ALTER TABLE public.vehicles ADD COLUMN insurance_policy_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'insurance_contact') THEN
        ALTER TABLE public.vehicles ADD COLUMN insurance_contact TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'current_mileage') THEN
        ALTER TABLE public.vehicles ADD COLUMN current_mileage INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'next_service_mileage') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_mileage INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'last_service_on') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_service_on DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'next_service_on') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_on DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'service_notes') THEN
        ALTER TABLE public.vehicles ADD COLUMN service_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'garage_location') THEN
        ALTER TABLE public.vehicles ADD COLUMN garage_location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'assigned_driver_id') THEN
        ALTER TABLE public.vehicles ADD COLUMN assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'amenities') THEN
        ALTER TABLE public.vehicles ADD COLUMN amenities TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'internal_notes') THEN
        ALTER TABLE public.vehicles ADD COLUMN internal_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'metadata') THEN
        ALTER TABLE public.vehicles ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- Ensure unit_number is populated and enforce NOT NULL only when safe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vehicles'
          AND column_name = 'unit_number'
    ) THEN
        WITH missing_units AS (
            SELECT id, CONCAT('UNIT-', SUBSTRING(id::TEXT, 1, 8)) AS generated_unit
            FROM public.vehicles
            WHERE unit_number IS NULL
        )
        UPDATE public.vehicles v
        SET unit_number = m.generated_unit
        FROM missing_units m
        WHERE v.id = m.id;

        IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE unit_number IS NULL) THEN
            ALTER TABLE public.vehicles ALTER COLUMN unit_number SET NOT NULL;
        ELSE
            RAISE NOTICE 'Skipped enforcing NOT NULL on vehicles.unit_number because NULL values remain.';
        END IF;
    END IF;

    -- Expand status constraint to cover UI states alongside legacy values
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vehicles_status_check'
          AND conrelid = 'public.vehicles'::regclass
    ) THEN
        ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_status_check;
    END IF;

    ALTER TABLE public.vehicles
        ADD CONSTRAINT vehicles_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE', 'AVAILABLE', 'IN_USE', 'RETIRED'));

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_org_unit_key'
    ) THEN
        ALTER TABLE public.vehicles
        DROP CONSTRAINT vehicles_org_unit_key;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_org_plate_key'
    ) THEN
        ALTER TABLE public.vehicles
        DROP CONSTRAINT vehicles_org_plate_key;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_org_vin_key'
    ) THEN
        ALTER TABLE public.vehicles
        DROP CONSTRAINT vehicles_org_vin_key;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS vehicles_org_idx ON public.vehicles (organization_id);
CREATE INDEX IF NOT EXISTS vehicles_type_idx ON public.vehicles (vehicle_type_id);
CREATE INDEX IF NOT EXISTS vehicles_driver_idx ON public.vehicles (assigned_driver_id);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON public.vehicles (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_unit_idx
    ON public.vehicles (organization_id, LOWER(unit_number));

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_plate_idx
    ON public.vehicles (organization_id, LOWER(license_plate))
    WHERE license_plate IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_vin_idx
    ON public.vehicles (organization_id, LOWER(vin))
    WHERE vin IS NOT NULL;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
