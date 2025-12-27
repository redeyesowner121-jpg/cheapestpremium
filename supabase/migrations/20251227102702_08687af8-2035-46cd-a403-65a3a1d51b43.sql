-- Allow admins to update any profile (for gifting money, blue tick, etc.)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Allow admins to insert transactions for any user
CREATE POLICY "Admins can insert transactions for any user"
ON public.transactions
FOR INSERT
WITH CHECK (is_admin(auth.uid()));