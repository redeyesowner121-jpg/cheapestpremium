CREATE TABLE public.binance_amount_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  amount_usd numeric NOT NULL,
  amount_inr numeric NOT NULL,
  payment_id uuid,
  status text NOT NULL DEFAULT 'reserved',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.binance_amount_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages binance reservations"
  ON public.binance_amount_reservations FOR ALL
  USING (false);
