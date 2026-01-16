-- ============================================================
-- Rate Scheme Management Functions
-- Run this in Supabase SQL Editor
-- ============================================================

-- First, enable RLS and add policies for saved_rate_schemes table
ALTER TABLE public.saved_rate_schemes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on saved_rate_schemes" ON public.saved_rate_schemes;
DROP POLICY IF EXISTS "Allow authenticated users to manage saved_rate_schemes" ON public.saved_rate_schemes;
DROP POLICY IF EXISTS "Allow anon to read saved_rate_schemes" ON public.saved_rate_schemes;

-- Create permissive policies for saved_rate_schemes
CREATE POLICY "Allow all operations on saved_rate_schemes"
ON public.saved_rate_schemes
FOR ALL
USING (true)
WITH CHECK (true);

-- Also enable RLS and add policies for saved_rate_scheme_entries table
ALTER TABLE public.saved_rate_scheme_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on saved_rate_scheme_entries" ON public.saved_rate_scheme_entries;

-- Create permissive policies for saved_rate_scheme_entries
CREATE POLICY "Allow all operations on saved_rate_scheme_entries"
ON public.saved_rate_scheme_entries
FOR ALL
USING (true)
WITH CHECK (true);

-- 1) save_vehicle_rate_scheme
-- Saves the current rate matrix entries as a reusable named scheme
CREATE OR REPLACE FUNCTION public.save_vehicle_rate_scheme(
  p_vehicle_type_id UUID,
  p_rate_type TEXT,
  p_scheme_name TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_matrix_id UUID;
  v_scheme_id UUID;
  v_entry RECORD;
BEGIN
  -- Validate rate_type
  IF p_rate_type NOT IN ('PER_HOUR', 'PER_PASSENGER', 'DISTANCE') THEN
    RAISE EXCEPTION 'Invalid rate_type: %. Must be PER_HOUR, PER_PASSENGER, or DISTANCE', p_rate_type;
  END IF;

  -- Get organization_id from vehicle_type
  SELECT organization_id INTO v_org_id
  FROM public.vehicle_types
  WHERE id = p_vehicle_type_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle type not found: %', p_vehicle_type_id;
  END IF;

  -- Check for duplicate scheme name in this organization
  IF EXISTS (
    SELECT 1 FROM public.saved_rate_schemes
    WHERE organization_id = v_org_id
      AND rate_type = p_rate_type
      AND name = p_scheme_name
  ) THEN
    RAISE EXCEPTION 'A scheme named "%" already exists for this rate type', p_scheme_name;
  END IF;

  -- Get the current rate matrix for this vehicle type and rate type
  SELECT id INTO v_matrix_id
  FROM public.vehicle_type_rate_matrices
  WHERE vehicle_type_id = p_vehicle_type_id
    AND rate_type = p_rate_type
  LIMIT 1;

  IF v_matrix_id IS NULL THEN
    RAISE EXCEPTION 'No rate matrix found for vehicle type % with rate type %', p_vehicle_type_id, p_rate_type;
  END IF;

  -- Create the saved scheme
  INSERT INTO public.saved_rate_schemes (
    organization_id,
    source_vehicle_type_id,
    rate_type,
    name,
    created_by
  ) VALUES (
    v_org_id,
    p_vehicle_type_id,
    p_rate_type,
    p_scheme_name,
    p_created_by
  )
  RETURNING id INTO v_scheme_id;

  -- Copy all entries from the matrix to the scheme
  INSERT INTO public.saved_rate_scheme_entries (
    scheme_id,
    from_quantity,
    to_quantity,
    rate,
    unit,
    sort_order
  )
  SELECT
    v_scheme_id,
    from_quantity,
    to_quantity,
    rate,
    unit,
    sort_order
  FROM public.vehicle_type_rate_entries
  WHERE rate_matrix_id = v_matrix_id
  ORDER BY sort_order, created_at;

  RETURN v_scheme_id;
END;
$$;

-- 2) apply_saved_rate_scheme_to_vehicle
-- Applies a saved scheme to a target vehicle type
CREATE OR REPLACE FUNCTION public.apply_saved_rate_scheme_to_vehicle(
  p_target_vehicle_type_id UUID,
  p_scheme_id UUID,
  p_make_default BOOLEAN DEFAULT FALSE,
  p_matrix_name TEXT DEFAULT NULL,
  p_matrix_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_rate_type TEXT;
  v_scheme_name TEXT;
  v_new_matrix_id UUID;
  v_existing_matrix_id UUID;
  v_entry RECORD;
BEGIN
  -- Get scheme details
  SELECT organization_id, rate_type, name INTO v_org_id, v_rate_type, v_scheme_name
  FROM public.saved_rate_schemes
  WHERE id = p_scheme_id;

  IF v_rate_type IS NULL THEN
    RAISE EXCEPTION 'Scheme not found: %', p_scheme_id;
  END IF;

  -- Verify target vehicle belongs to same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicle_types
    WHERE id = p_target_vehicle_type_id
      AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Target vehicle type not found or belongs to different organization';
  END IF;

  -- Check if a matrix already exists for this vehicle/rate_type
  SELECT id INTO v_existing_matrix_id
  FROM public.vehicle_type_rate_matrices
  WHERE vehicle_type_id = p_target_vehicle_type_id
    AND rate_type = v_rate_type
  LIMIT 1;

  -- If making this default, unset any existing defaults for this vehicle/rate_type
  IF p_make_default AND v_existing_matrix_id IS NOT NULL THEN
    UPDATE public.vehicle_type_rate_matrices
    SET is_default = FALSE
    WHERE vehicle_type_id = p_target_vehicle_type_id
      AND rate_type = v_rate_type
      AND is_default = TRUE;
  END IF;

  -- Delete existing matrix and entries if present (replace behavior)
  IF v_existing_matrix_id IS NOT NULL THEN
    DELETE FROM public.vehicle_type_rate_entries WHERE rate_matrix_id = v_existing_matrix_id;
    DELETE FROM public.vehicle_type_rate_matrices WHERE id = v_existing_matrix_id;
  END IF;

  -- Create new matrix
  INSERT INTO public.vehicle_type_rate_matrices (
    organization_id,
    vehicle_type_id,
    rate_type,
    name,
    description,
    is_default,
    currency
  ) VALUES (
    v_org_id,
    p_target_vehicle_type_id,
    v_rate_type,
    COALESCE(p_matrix_name, v_scheme_name),
    p_matrix_description,
    p_make_default,
    'USD'
  )
  RETURNING id INTO v_new_matrix_id;

  -- Copy entries from scheme to new matrix
  INSERT INTO public.vehicle_type_rate_entries (
    rate_matrix_id,
    from_quantity,
    to_quantity,
    rate,
    unit,
    sort_order
  )
  SELECT
    v_new_matrix_id,
    from_quantity,
    to_quantity,
    rate,
    unit,
    sort_order
  FROM public.saved_rate_scheme_entries
  WHERE scheme_id = p_scheme_id
  ORDER BY sort_order, created_at;

  RETURN v_new_matrix_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.save_vehicle_rate_scheme TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_vehicle_rate_scheme TO anon;
GRANT EXECUTE ON FUNCTION public.apply_saved_rate_scheme_to_vehicle TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_saved_rate_scheme_to_vehicle TO anon;

-- Add comments
COMMENT ON FUNCTION public.save_vehicle_rate_scheme IS 'Saves the current rate matrix entries for a vehicle type as a reusable named scheme';
COMMENT ON FUNCTION public.apply_saved_rate_scheme_to_vehicle IS 'Applies a saved rate scheme to a target vehicle type, creating or replacing the rate matrix';
