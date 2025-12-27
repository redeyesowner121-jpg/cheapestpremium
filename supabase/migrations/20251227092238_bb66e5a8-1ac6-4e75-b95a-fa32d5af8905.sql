-- Add stock column to products table
ALTER TABLE public.products ADD COLUMN stock integer DEFAULT NULL;

-- Add stock column to seller_products table  
ALTER TABLE public.seller_products ADD COLUMN stock integer DEFAULT NULL;