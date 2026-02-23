
-- Add slug column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Populate slugs for existing products as product-1, product-2, etc.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.products
)
UPDATE public.products p
SET slug = 'product-' || n.rn
FROM numbered n
WHERE p.id = n.id;

-- Make slug NOT NULL after population
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
