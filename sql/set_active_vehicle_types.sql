-- =====================================================
-- Set all vehicle types to INACTIVE except: Sedan, Executive Sedan, Black SUV, SUV
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, set ALL vehicle types to INACTIVE
UPDATE public.vehicle_types 
SET status = 'INACTIVE', 
    active = false,
    updated_at = NOW();

-- Then set only the 4 desired types to ACTIVE (case-insensitive match)
UPDATE public.vehicle_types 
SET status = 'ACTIVE', 
    active = true,
    updated_at = NOW()
WHERE LOWER(TRIM(name)) IN (
    'sedan',
    'executive sedan',
    'black suv',
    'suv'
);

-- Verify the results
SELECT id, name, status, active 
FROM public.vehicle_types 
ORDER BY status DESC, name;
