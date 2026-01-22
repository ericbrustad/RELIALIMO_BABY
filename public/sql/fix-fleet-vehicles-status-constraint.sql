-- ============================================
-- Fix fleet_vehicles Status Constraint
-- The UI uses uppercase status values (ACTIVE, AVAILABLE, etc.)
-- but the database constraint may be restricting them
-- ============================================

-- Drop the old constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fleet_vehicles_status_check'
          AND conrelid = 'public.fleet_vehicles'::regclass
    ) THEN
        ALTER TABLE public.fleet_vehicles DROP CONSTRAINT fleet_vehicles_status_check;
        RAISE NOTICE 'Dropped existing fleet_vehicles_status_check constraint';
    END IF;
END $$;

-- Add the new constraint with all valid UI status values
ALTER TABLE public.fleet_vehicles
    ADD CONSTRAINT fleet_vehicles_status_check
    CHECK (status IN (
        'ACTIVE', 
        'AVAILABLE', 
        'IN_USE', 
        'MAINTENANCE', 
        'OUT_OF_SERVICE', 
        'INACTIVE', 
        'RETIRED',
        -- Also allow lowercase for backward compatibility
        'active',
        'available',
        'in_use',
        'maintenance',
        'out_of_service',
        'inactive',
        'retired'
    ));

-- Set default status if column doesn't have one
ALTER TABLE public.fleet_vehicles 
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- Show success message
DO $$
BEGIN
    RAISE NOTICE 'fleet_vehicles_status_check constraint updated successfully!';
    RAISE NOTICE 'Valid status values: ACTIVE, AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE, INACTIVE, RETIRED';
END $$;
