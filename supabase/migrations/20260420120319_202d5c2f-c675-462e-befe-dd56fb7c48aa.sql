-- Add delivery_mode to product_variations (per-variation delivery setting)
ALTER TABLE public.product_variations
ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'repeated';

-- Add variation_id to product_stock_items so each stock item belongs to a specific variation
ALTER TABLE public.product_stock_items
ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_stock_items_variation
  ON public.product_stock_items(variation_id, is_used);

-- Backfill: any product currently set to 'unique' delivery → mark all its variations as 'unique' auto-delivery
UPDATE public.product_variations pv
SET delivery_mode = 'unique'
FROM public.products p
WHERE pv.product_id = p.id
  AND p.delivery_mode = 'unique';

-- Update finalize_instant_delivery to be variation-aware
CREATE OR REPLACE FUNCTION public.finalize_instant_delivery(p_product_id uuid, p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_variation_id uuid;
  v_var_delivery text;
  v_product_delivery text;
  v_access_link text;
  v_show_in_website boolean;
BEGIN
  SELECT delivery_mode, access_link, show_link_in_website
  INTO v_product_delivery, v_access_link, v_show_in_website
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND OR v_show_in_website = false THEN
    RETURN NULL;
  END IF;

  -- Try to detect variation used in this order via cart-like lookup is not possible here; rely on order's product_name match against variations
  SELECT pv.id, pv.delivery_mode INTO v_variation_id, v_var_delivery
  FROM product_variations pv
  JOIN orders o ON o.product_id = pv.product_id
  WHERE o.id = p_order_id
    AND pv.is_active = true
    AND (o.product_name ILIKE '%' || pv.name || '%')
  ORDER BY length(pv.name) DESC
  LIMIT 1;

  -- Variation-level unique stock takes priority
  IF v_variation_id IS NOT NULL AND v_var_delivery = 'unique' THEN
    UPDATE product_stock_items
    SET is_used = true, used_at = now(), order_id = p_order_id
    WHERE id = (
      SELECT id FROM product_stock_items
      WHERE variation_id = v_variation_id AND is_used = false
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING access_link INTO v_access_link;
  ELSIF v_product_delivery = 'unique' THEN
    -- Legacy product-level unique stock (no variation_id assigned)
    UPDATE product_stock_items
    SET is_used = true, used_at = now(), order_id = p_order_id
    WHERE id = (
      SELECT id FROM product_stock_items
      WHERE product_id = p_product_id AND variation_id IS NULL AND is_used = false
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING access_link INTO v_access_link;
  END IF;

  IF v_access_link IS NOT NULL THEN
    UPDATE orders
    SET access_link = v_access_link, status = 'confirmed'
    WHERE id = p_order_id;
  END IF;

  RETURN v_access_link;
END;
$function$;