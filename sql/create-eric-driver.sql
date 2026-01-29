-- Check and Create Driver for ericbrustad@gmail.com
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Step 1: Check if driver already exists
SELECT id, first_name, last_name, email, status, driver_status 
FROM drivers 
WHERE email ILIKE 'ericbrustad@gmail.com';

-- Step 2: If no results above, run this INSERT:
INSERT INTO drivers (
    first_name,
    last_name,
    email,
    phone,
    status,
    driver_status,
    created_at,
    updated_at
) VALUES (
    'Eric',
    'Brustad',
    'ericbrustad@gmail.com',
    '+17632838336',
    'active',
    'available',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    status = 'active',
    driver_status = COALESCE(drivers.driver_status, 'available'),
    updated_at = NOW()
RETURNING *;
