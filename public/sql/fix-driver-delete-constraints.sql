-- ============================================
-- Fix Driver Delete Constraints
-- Allow driver deletion by setting FK to ON DELETE SET NULL
-- ============================================

-- Drop and recreate the foreign key constraint for assigned_driver_id in reservations
-- This allows deleting a driver even if they have reservations (sets the field to NULL)

-- First, drop the existing constraint (if it exists)
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_assigned_driver_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE reservations 
ADD CONSTRAINT reservations_assigned_driver_id_fkey 
FOREIGN KEY (assigned_driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL;

-- Also fix current_offer_driver_id constraint
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_current_offer_driver_id_fkey;

ALTER TABLE reservations 
ADD CONSTRAINT reservations_current_offer_driver_id_fkey 
FOREIGN KEY (current_offer_driver_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL;

-- Verify the constraints were updated
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'reservations'
    AND kcu.column_name LIKE '%driver%';
