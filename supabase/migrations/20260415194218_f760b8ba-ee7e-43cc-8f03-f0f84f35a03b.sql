
CREATE OR REPLACE FUNCTION public.finalize_instant_delivery(
  p_product_id uuid,
  p_order_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_mode text;
  v_access_link text;
  v_show_in_website boolean;
BEGIN
  SELECT delivery_mode, access_link, show_link_in_website
  INTO v_delivery_mode, v_access_link, v_show_in_website
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND OR v_show_in_website = false THEN
    RETURN NULL;
  END IF;

  IF v_delivery_mode = 'unique' THEN
    UPDATE product_stock_items
    SET is_used = true,
        used_at = now(),
        order_id = p_order_id
    WHERE id = (
      SELECT id FROM product_stock_items
      WHERE product_id = p_product_id AND is_used = false
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING access_link INTO v_access_link;
  END IF;

  IF v_access_link IS NOT NULL THEN
    UPDATE orders
    SET access_link = v_access_link,
        status = 'confirmed'
    WHERE id = p_order_id;
  END IF;

  RETURN v_access_link;
END;
$$;

-- Drop the old function as it's no longer needed
DROP FUNCTION IF EXISTS public.claim_stock_item(uuid, uuid);
