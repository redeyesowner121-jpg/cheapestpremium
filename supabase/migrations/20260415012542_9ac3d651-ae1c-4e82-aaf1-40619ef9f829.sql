-- Allow admins to delete price_history records
CREATE POLICY "Admins can delete price history"
ON public.price_history
FOR DELETE
USING (is_admin(auth.uid()));

-- Allow admins to delete cart_items (needed when removing variations)
CREATE POLICY "Admins can delete any cart items"
ON public.cart_items
FOR DELETE
USING (is_admin(auth.uid()));
