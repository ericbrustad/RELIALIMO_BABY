-- Migration: add review fields to driver_applications

ALTER TABLE public.driver_applications
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS driver_applications_reviewed_by_idx ON public.driver_applications (reviewed_by);
