
-- Function to clean up existing slugs
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  new_slug TEXT;
  counter INT;
BEGIN
  FOR rec IN SELECT id, name FROM public.products ORDER BY created_at ASC NULLS LAST
  LOOP
    -- Generate clean slug from name
    base_slug := lower(rec.name);
    base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    base_slug := left(base_slug, 50);
    
    IF base_slug = '' THEN
      base_slug := 'product';
    END IF;
    
    -- Check for duplicates (excluding current product)
    new_slug := base_slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM public.products WHERE slug = new_slug AND id != rec.id) LOOP
      new_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    
    UPDATE public.products SET slug = new_slug WHERE id = rec.id;
  END LOOP;
END $$;
