/*
  # Add Missing Product Columns

  1. Add reseller_price to product_variations table
  2. Add stock, slug, seo_tags to products table

  These columns are referenced in the admin UI but missing from the schema.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variations' AND column_name = 'reseller_price'
  ) THEN
    ALTER TABLE product_variations ADD COLUMN reseller_price numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stock'
  ) THEN
    ALTER TABLE products ADD COLUMN stock integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'slug'
  ) THEN
    ALTER TABLE products ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'seo_tags'
  ) THEN
    ALTER TABLE products ADD COLUMN seo_tags text;
  END IF;
END $$;
