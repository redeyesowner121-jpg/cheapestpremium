
CREATE OR REPLACE FUNCTION public.claim_stock_item(
  p_product_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_item RECORD;
  v_delivery_mode text;
  v_access_link text;
  v_show_in_website boolean;
BEGIN
  -- Get product delivery info
  SELECT delivery_mode, access_link, show_link_in_website
  INTO v_delivery_mode, v_access_link, v_show_in_website
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If website display is disabled, return NULL
  IF v_show_in_website = false THEN
    RETURN NULL;
  END IF;

  IF v_delivery_mode = 'unique' THEN
    -- Claim the oldest unused stock item atomically
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

    RETURN v_access_link;
  ELSE
    -- Repeated mode: return product-level access_link
    RETURN v_access_link;
  END IF;
END;
$$;
