
-- Fix profiles UPDATE policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Fix transactions INSERT policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Admins can insert transactions for any user" ON public.transactions;
DROP POLICY IF EXISTS "Users can create own transactions" ON public.transactions;

CREATE POLICY "Admins can insert transactions for any user"
  ON public.transactions FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
