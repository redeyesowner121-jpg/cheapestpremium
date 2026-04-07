
CREATE POLICY "Users can insert own payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can read own payments"
ON public.payments FOR SELECT TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own reservations"
ON public.binance_amount_reservations FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can read all reservations"
ON public.binance_amount_reservations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can update own reservations"
ON public.binance_amount_reservations FOR UPDATE TO authenticated
USING (auth.uid()::text = user_id);
