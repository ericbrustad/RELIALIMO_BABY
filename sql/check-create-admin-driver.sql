-- Check and Create Admin Driver for React Native App
-- Run this in the Supabase SQL Editor

-- First, check what drivers exist
SELECT id, first_name, last_name, email, status, driver_status 
FROM drivers 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if a driver with admin email exists
SELECT * FROM drivers WHERE email ILIKE 'admin@relialimo.com';

-- Check if a driver with ericbrustad email exists  
SELECT * FROM drivers WHERE email ILIKE 'ericbrustad@gmail.com';

-- If you need to create a driver record for the admin account, uncomment and run:
/*
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
    'Admin',
    'User',
    'admin@relialimo.com',  -- Change this to match your Supabase Auth email
    '',
    'active',
    'available',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING *;
*/

-- Or if using ericbrustad@gmail.com:
/*
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
    'ericbrustad@gmail.com',  -- Change this to match your Supabase Auth email
    '+17632838336',
    'active',
    'available',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING *;
*/

-- Alternative: Update an existing driver's email if needed
/*
UPDATE drivers 
SET email = 'YOUR_SUPABASE_AUTH_EMAIL@example.com'
WHERE id = 'YOUR_DRIVER_UUID'
RETURNING *;
*/
