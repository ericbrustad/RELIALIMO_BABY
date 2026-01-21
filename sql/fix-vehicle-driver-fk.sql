-- =====================================================
-- Fix Vehicle-Driver Foreign Key Constraint
-- When a vehicle is deleted, set driver's assigned_vehicle_id to NULL
-- =====================================================

-- Drop the existing constraint
ALTER TABLE drivers 
DROP CONSTRAINT IF EXISTS drivers_assigned_vehicle_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE drivers
ADD CONSTRAINT drivers_assigned_vehicle_id_fkey 
FOREIGN KEY (assigned_vehicle_id) 
REFERENCES fleet_vehicles(id) 
ON DELETE SET NULL;

-- Verify the constraint was updated
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
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'drivers'
  AND kcu.column_name = 'assigned_vehicle_id';
