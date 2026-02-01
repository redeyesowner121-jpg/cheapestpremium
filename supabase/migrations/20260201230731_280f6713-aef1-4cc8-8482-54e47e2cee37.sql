-- Create RPC function for atomic coupon used_count increment
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons 
  SET used_count = COALESCE(used_count, 0) + 1,
      updated_at = now()
  WHERE id = coupon_id;
END;
$$;

-- Create RPC function for atomic product sold_count and stock update
CREATE OR REPLACE FUNCTION public.increment_product_sold_count(product_id uuid, qty integer, has_stock boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_stock THEN
    UPDATE public.products 
    SET sold_count = COALESCE(sold_count, 0) + qty,
        stock = GREATEST(0, COALESCE(stock, 0) - qty),
        updated_at = now()
    WHERE id = product_id;
  ELSE
    UPDATE public.products 
    SET sold_count = COALESCE(sold_count, 0) + qty,
        updated_at = now()
    WHERE id = product_id;
  END IF;
END;
$$;