-- =====================================================
-- CLEANUP: Find and remove duplicate vehicles
-- Run this in Supabase SQL Editor to identify and fix duplicate UUIDs
-- =====================================================

-- First, let's see what duplicates exist
SELECT id, COUNT(*) as count, 
       array_agg(veh_disp_name) as vehicle_names,
       array_agg(ctid) as row_ids
FROM public.vehicles
GROUP BY id
HAVING COUNT(*) > 1;

-- If duplicates exist, you can remove them by keeping only the first occurrence
-- IMPORTANT: Review the output above before running the DELETE below

-- DELETE duplicates keeping the first row (by ctid)
/*
DELETE FROM public.vehicles a
USING (
  SELECT MIN(ctid) as min_ctid, id
  FROM public.vehicles
  GROUP BY id
  HAVING COUNT(*) > 1
) b
WHERE a.id = b.id
AND a.ctid <> b.min_ctid;
*/

-- Alternative: View all vehicles to manually identify issues
SELECT id, veh_disp_name, make, model, year, status, created_at, updated_at
FROM public.vehicles
ORDER BY id, created_at;
