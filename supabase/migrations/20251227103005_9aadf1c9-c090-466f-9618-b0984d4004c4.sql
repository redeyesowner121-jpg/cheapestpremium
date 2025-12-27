-- Add explicit DELETE policy for products (in case ALL doesn't cover it properly)
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add explicit DELETE policy for product_variations
CREATE POLICY "Admins can delete variations" 
ON public.product_variations 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add explicit DELETE policy for banners
CREATE POLICY "Admins can delete banners" 
ON public.banners 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add explicit DELETE policy for flash_sales
CREATE POLICY "Admins can delete flash_sales" 
ON public.flash_sales 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Add explicit DELETE policy for announcements
CREATE POLICY "Admins can delete announcements" 
ON public.announcements 
FOR DELETE 
USING (is_admin(auth.uid()));