
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
  v_remaining int;
BEGIN
  SELECT delivery_mode, access_link, show_link_in_website
  INTO v_product_delivery, v_access_link, v_show_in_website
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND OR v_show_in_website = false THEN
    RETURN NULL;
  END IF;

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
    -- First try variation-specific stock
    UPDATE product_stock_items
    SET is_used = true, used_at = now(), order_id = p_order_id
    WHERE id = (
      SELECT id FROM product_stock_items
      WHERE variation_id = v_variation_id AND is_used = false
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING access_link INTO v_access_link;

    -- Fallback: try product-level stock (variation_id IS NULL) if no variation stock found
    IF v_access_link IS NULL THEN
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

    -- Check if stock is now empty, switch to manual
    IF v_access_link IS NOT NULL THEN
      SELECT count(*) INTO v_remaining
      FROM product_stock_items
      WHERE (variation_id = v_variation_id OR (product_id = p_product_id AND variation_id IS NULL)) AND is_used = false;

      IF v_remaining = 0 THEN
        UPDATE product_variations SET delivery_mode = 'repeated' WHERE id = v_variation_id;
      END IF;
    END IF;

  ELSIF v_product_delivery = 'unique' THEN
    UPDATE product_stock_items
    SET is_used = true, used_at = now(), order_id = p_order_id
    WHERE id = (
      SELECT id FROM product_stock_items
      WHERE product_id = p_product_id AND variation_id IS NULL AND is_used = false
      ORDER BY created_at ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING access_link INTO v_access_link;

    -- Check if stock is now empty, switch to manual
    IF v_access_link IS NOT NULL THEN
      SELECT count(*) INTO v_remaining
      FROM product_stock_items
      WHERE product_id = p_product_id AND variation_id IS NULL AND is_used = false;

      IF v_remaining = 0 THEN
        UPDATE products SET delivery_mode = 'repeated' WHERE id = p_product_id;
      END IF;
    END IF;
  END IF;

  IF v_access_link IS NOT NULL THEN
    UPDATE orders
    SET access_link = v_access_link, status = 'confirmed'
    WHERE id = p_order_id;
  END IF;

  RETURN v_access_link;
END;
$function$;
