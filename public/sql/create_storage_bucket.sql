-- =====================================================
-- Create Supabase Storage bucket for vehicle type images
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create the storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'vehicle-type-images',
    'vehicle-type-images',
    true,  -- Public bucket (images can be viewed without auth)
    5242880,  -- 5MB max file size
    ARRAY['image/gif', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/gif', 'image/jpeg', 'image/jpg', 'image/png'];

-- Create storage policy for authenticated uploads
CREATE POLICY IF NOT EXISTS "Authenticated users can upload vehicle type images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicle-type-images');

-- Create storage policy for authenticated updates
CREATE POLICY IF NOT EXISTS "Authenticated users can update their vehicle type images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicle-type-images');

-- Create storage policy for authenticated deletes
CREATE POLICY IF NOT EXISTS "Authenticated users can delete their vehicle type images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-type-images');

-- Create storage policy for public reads (anyone can view images)
CREATE POLICY IF NOT EXISTS "Anyone can view vehicle type images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vehicle-type-images');

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'vehicle-type-images';
