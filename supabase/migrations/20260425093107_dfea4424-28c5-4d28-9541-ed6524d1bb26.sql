CREATE OR REPLACE FUNCTION public.finalize_instant_delivery(p_product_id uuid, p_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_variation_id uuid;
  v_var_delivery text;
  v_var_link text;
  v_var_message text;
  v_product_delivery text;
  v_product_link text;
  v_access_link text;
  v_show_in_website boolean;
  v_remaining int;
BEGIN
  SELECT delivery_mode, access_link, show_link_in_website
  INTO v_product_delivery, v_product_link, v_show_in_website
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND OR v_show_in_website = false THEN
    RETURN NULL;
  END IF;

  -- Try to identify selected variation by matching name in product_name
  SELECT pv.id, pv.delivery_mode, pv.access_link, pv.delivery_message
  INTO v_variation_id, v_var_delivery, v_var_link, v_var_message
  FROM product_variations pv
  JOIN orders o ON o.product_id = pv.product_id
  WHERE o.id = p_order_id
    AND pv.is_active = true
    AND (o.product_name ILIKE '%' || pv.name || '%')
  ORDER BY length(pv.name) DESC
  LIMIT 1;

  -- 1) Variation-level unique stock
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

    IF v_access_link IS NOT NULL THEN
      SELECT count(*) INTO v_remaining
      FROM product_stock_items
      WHERE (variation_id = v_variation_id OR (product_id = p_product_id AND variation_id IS NULL)) AND is_used = false;
      IF v_remaining = 0 THEN
        UPDATE product_variations SET delivery_mode = 'repeated' WHERE id = v_variation_id;
      END IF;
    END IF;

  -- 2) Product-level unique stock
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

    IF v_access_link IS NOT NULL THEN
      SELECT count(*) INTO v_remaining
      FROM product_stock_items
      WHERE product_id = p_product_id AND variation_id IS NULL AND is_used = false;
      IF v_remaining = 0 THEN
        UPDATE products SET delivery_mode = 'repeated' WHERE id = p_product_id;
      END IF;
    END IF;
  END IF;

  -- 3) Fallback: variation's own access_link or delivery_message (repeated mode)
  IF v_access_link IS NULL AND v_variation_id IS NOT NULL THEN
    IF v_var_link IS NOT NULL AND length(trim(v_var_link)) > 0 THEN
      v_access_link := v_var_link;
    ELSIF v_var_message IS NOT NULL AND length(trim(v_var_message)) > 0 THEN
      v_access_link := v_var_message;
    END IF;
  END IF;

  -- 4) Fallback: product-level access_link
  IF v_access_link IS NULL AND v_product_link IS NOT NULL AND length(trim(v_product_link)) > 0 THEN
    v_access_link := v_product_link;
  END IF;

  IF v_access_link IS NOT NULL THEN
    UPDATE orders
    SET access_link = v_access_link, status = 'confirmed', updated_at = now()
    WHERE id = p_order_id;
  END IF;

  RETURN v_access_link;
END;
$function$;