-- Drop and recreate FK on payments to allow cascade delete of variations
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_variation_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Same for flash_sales
ALTER TABLE public.flash_sales DROP CONSTRAINT IF EXISTS flash_sales_variation_id_fkey;
ALTER TABLE public.flash_sales ADD CONSTRAINT flash_sales_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Same for price_history
ALTER TABLE public.price_history DROP CONSTRAINT IF EXISTS price_history_variation_id_fkey;
ALTER TABLE public.price_history ADD CONSTRAINT price_history_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Same for cart_items
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_variation_id_fkey;
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Same for resale_links
ALTER TABLE public.resale_links DROP CONSTRAINT IF EXISTS resale_links_variation_id_fkey;
ALTER TABLE public.resale_links ADD CONSTRAINT resale_links_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;

-- Same for giveaway_products
ALTER TABLE public.giveaway_products DROP CONSTRAINT IF EXISTS giveaway_products_variation_id_fkey;
ALTER TABLE public.giveaway_products ADD CONSTRAINT giveaway_products_variation_id_fkey
  FOREIGN KEY (variation_id) REFERENCES public.product_variations(id) ON DELETE SET NULL;