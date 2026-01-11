-- Create storage bucket for payment QR images
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-assets', 'payment-assets', true);

-- Create policy for public read access
CREATE POLICY "Payment assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-assets');

-- Create policy for admin uploads
CREATE POLICY "Only admins can upload payment assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Create policy for admin updates
CREATE POLICY "Only admins can update payment assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Create policy for admin deletes
CREATE POLICY "Only admins can delete payment assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);