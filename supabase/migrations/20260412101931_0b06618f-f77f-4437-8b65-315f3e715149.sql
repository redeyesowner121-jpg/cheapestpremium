
-- Allow admins to view giveaway_points
CREATE POLICY "Admins can view giveaway_points"
ON public.giveaway_points FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to update giveaway_points
CREATE POLICY "Admins can update giveaway_points"
ON public.giveaway_points FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to view giveaway_referrals
CREATE POLICY "Admins can view giveaway_referrals"
ON public.giveaway_referrals FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to manage giveaway_settings (read/update/insert)
CREATE POLICY "Admins can view giveaway_settings_v2"
ON public.giveaway_settings FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update giveaway_settings_v2"
ON public.giveaway_settings FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert giveaway_settings_v2"
ON public.giveaway_settings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));
