
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active resale links" ON public.resale_links;
DROP POLICY IF EXISTS "Resellers can manage own links" ON public.resale_links;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Anyone can view active resale links"
ON public.resale_links
FOR SELECT
USING (is_active = true);

CREATE POLICY "Resellers can manage own links"
ON public.resale_links
FOR ALL
USING (auth.uid() = reseller_id)
WITH CHECK (auth.uid() = reseller_id);

-- Also allow admins to manage all resale links
CREATE POLICY "Admins can manage all resale links"
ON public.resale_links
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));
