-- Drop the conflicting policies and create a simpler one for product-images bucket
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;

-- Create a single policy that allows any authenticated user to upload
CREATE POLICY "Allow authenticated uploads to product-images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
);