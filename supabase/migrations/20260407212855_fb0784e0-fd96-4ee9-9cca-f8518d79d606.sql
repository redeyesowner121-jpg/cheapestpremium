
CREATE TABLE public.razorpay_amount_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  base_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  deposit_request_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.razorpay_amount_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages reservations" ON public.razorpay_amount_reservations
  FOR ALL TO public USING (false);

CREATE POLICY "Users can view own reservations" ON public.razorpay_amount_reservations
  FOR SELECT TO public USING (auth.uid() = user_id);
