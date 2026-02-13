-- Add variation_id column to flash_sales table
ALTER TABLE public.flash_sales
ADD COLUMN variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Add variation_name column for display purposes (denormalized for speed)
ALTER TABLE public.flash_sales
ADD COLUMN variation_name text;