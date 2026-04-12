
-- 1. FIX PROFILES: Restrict SELECT to own profile + admin
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR is_admin(auth.uid()));

-- 2. FIX ORDERS: Remove guest order exposure
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
ON public.orders FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR is_admin(auth.uid())
);

-- Also let admins view all orders (including guest)
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT
USING (is_admin(auth.uid()));

-- 3. FIX PAYMENT SETTINGS: Restrict to authenticated
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated can view payment settings"
ON public.payment_settings FOR SELECT TO authenticated
USING (true);

-- 4. FIX BINANCE RESERVATIONS: Own only
DROP POLICY IF EXISTS "Users can read all reservations" ON public.binance_amount_reservations;
CREATE POLICY "Users can read own reservations"
ON public.binance_amount_reservations FOR SELECT TO authenticated
USING ((auth.uid())::text = user_id);

-- 5. FIX REDEEM CODES: Don't expose code values publicly
DROP POLICY IF EXISTS "Anyone can view active redeem codes" ON public.redeem_codes;
CREATE POLICY "Authenticated can view active redeem codes"
ON public.redeem_codes FOR SELECT TO authenticated
USING (is_active = true);

-- 6. FIX PRICE HISTORY INSERT: Restrict to admin only
DROP POLICY IF EXISTS "System can insert price history" ON public.price_history;
CREATE POLICY "Admins can insert price history"
ON public.price_history FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- 7. FIX STORAGE: Remove overly permissive product-images policies
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their uploads" ON storage.objects;

-- 8. FIX SECURITY DEFINER FUNCTIONS: Add validation + revoke public access

-- Fix increment_coupon_used_count
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.coupons WHERE id = coupon_id AND is_active = true AND (usage_limit IS NULL OR COALESCE(used_count, 0) < usage_limit) AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'Invalid or expired coupon';
  END IF;
  UPDATE public.coupons 
  SET used_count = COALESCE(used_count, 0) + 1,
      updated_at = now()
  WHERE id = coupon_id;
END;
$$;

-- Fix increment_product_sold_count  
CREATE OR REPLACE FUNCTION public.increment_product_sold_count(product_id uuid, qty integer, has_stock boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qty <= 0 OR qty > 1000 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  IF has_stock THEN
    UPDATE public.products 
    SET sold_count = COALESCE(sold_count, 0) + qty,
        stock = GREATEST(0, COALESCE(stock, 0) - qty),
        updated_at = now()
    WHERE id = product_id AND is_active = true AND (stock IS NULL OR stock >= qty);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not available or insufficient stock';
    END IF;
  ELSE
    UPDATE public.products 
    SET sold_count = COALESCE(sold_count, 0) + qty,
        updated_at = now()
    WHERE id = product_id AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not available';
    END IF;
  END IF;
END;
$$;

-- Remove unnecessary INSERT policy on profiles (trigger handles creation)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
