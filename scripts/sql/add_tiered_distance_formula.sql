-- ============================================================
-- Add Tiered Distance Formula Fields to Vehicle Types
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add columns to vehicle_types table for tiered distance formula
-- Formula: C(D) = multiplier * (tier1_rate * min(D, tier1_max) + tier2_rate * min(max(D - tier1_max, 0), tier2_range) + tier3_rate * max(D - (tier1_max + tier2_range), 0))

-- Add tiered formula enabled flag
ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tiered_enabled BOOLEAN DEFAULT FALSE;

-- Add multiplier (applied to final result)
ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_formula_multiplier NUMERIC(5,2) DEFAULT 1.27;

-- Add Tier 1 configuration (first X miles at this rate)
ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tier1_rate NUMERIC(10,2) DEFAULT 7.87;

ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tier1_max NUMERIC(10,2) DEFAULT 3;

-- Add Tier 2 configuration (next Y miles at this rate)
ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tier2_rate NUMERIC(10,2) DEFAULT 3.50;

ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tier2_range NUMERIC(10,2) DEFAULT 7;

-- Add Tier 3 configuration (remaining miles at this rate)
ALTER TABLE public.vehicle_types 
ADD COLUMN IF NOT EXISTS distance_tier3_rate NUMERIC(10,2) DEFAULT 3.25;

-- Add comments for documentation
COMMENT ON COLUMN public.vehicle_types.distance_tiered_enabled IS 'Enable tiered distance formula instead of simple per-mile rate';
COMMENT ON COLUMN public.vehicle_types.distance_formula_multiplier IS 'Multiplier applied to final tiered calculation (e.g., 1.27 = 27% markup)';
COMMENT ON COLUMN public.vehicle_types.distance_tier1_rate IS 'Rate per mile for first tier1_max miles';
COMMENT ON COLUMN public.vehicle_types.distance_tier1_max IS 'Maximum miles charged at tier 1 rate';
COMMENT ON COLUMN public.vehicle_types.distance_tier2_rate IS 'Rate per mile for next tier2_range miles after tier 1';
COMMENT ON COLUMN public.vehicle_types.distance_tier2_range IS 'Number of miles charged at tier 2 rate';
COMMENT ON COLUMN public.vehicle_types.distance_tier3_rate IS 'Rate per mile for remaining miles after tier 1 + tier 2';

-- Create a function to calculate tiered distance cost
CREATE OR REPLACE FUNCTION public.calculate_tiered_distance_cost(
  p_vehicle_type_id UUID,
  p_distance_miles NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_multiplier NUMERIC;
  v_tier1_rate NUMERIC;
  v_tier1_max NUMERIC;
  v_tier2_rate NUMERIC;
  v_tier2_range NUMERIC;
  v_tier3_rate NUMERIC;
  v_tier3_start NUMERIC;
  v_tier1_miles NUMERIC;
  v_tier2_miles NUMERIC;
  v_tier3_miles NUMERIC;
  v_tier1_cost NUMERIC;
  v_tier2_cost NUMERIC;
  v_tier3_cost NUMERIC;
  v_subtotal NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Get formula parameters from vehicle type
  SELECT 
    COALESCE(distance_tiered_enabled, FALSE),
    COALESCE(distance_formula_multiplier, 1.27),
    COALESCE(distance_tier1_rate, 7.87),
    COALESCE(distance_tier1_max, 3),
    COALESCE(distance_tier2_rate, 3.50),
    COALESCE(distance_tier2_range, 7),
    COALESCE(distance_tier3_rate, 3.25)
  INTO 
    v_enabled, v_multiplier, v_tier1_rate, v_tier1_max, 
    v_tier2_rate, v_tier2_range, v_tier3_rate
  FROM public.vehicle_types
  WHERE id = p_vehicle_type_id;

  -- If not enabled or not found, return 0
  IF NOT v_enabled THEN
    RETURN 0;
  END IF;

  -- Calculate tier 3 start point
  v_tier3_start := v_tier1_max + v_tier2_range;

  -- Calculate miles in each tier
  v_tier1_miles := LEAST(p_distance_miles, v_tier1_max);
  v_tier2_miles := LEAST(GREATEST(p_distance_miles - v_tier1_max, 0), v_tier2_range);
  v_tier3_miles := GREATEST(p_distance_miles - v_tier3_start, 0);

  -- Calculate cost for each tier
  v_tier1_cost := v_tier1_rate * v_tier1_miles;
  v_tier2_cost := v_tier2_rate * v_tier2_miles;
  v_tier3_cost := v_tier3_rate * v_tier3_miles;

  -- Calculate total
  v_subtotal := v_tier1_cost + v_tier2_cost + v_tier3_cost;
  v_total := v_multiplier * v_subtotal;

  RETURN ROUND(v_total, 2);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_tiered_distance_cost TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_tiered_distance_cost TO anon;

-- Add comment
COMMENT ON FUNCTION public.calculate_tiered_distance_cost IS 'Calculate distance cost using tiered formula: M * (T1 * min(D, T1max) + T2 * min(max(D - T1max, 0), T2range) + T3 * max(D - T3start, 0))';
