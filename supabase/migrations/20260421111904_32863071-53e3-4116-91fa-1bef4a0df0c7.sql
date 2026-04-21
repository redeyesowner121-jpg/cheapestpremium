
CREATE TABLE public.used_binance_order_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binance_order_id text NOT NULL,
  telegram_id bigint NOT NULL,
  amount_usd numeric,
  amount_inr numeric,
  purpose text NOT NULL DEFAULT 'purchase',
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(binance_order_id)
);

ALTER TABLE public.used_binance_order_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for used_binance_order_ids"
  ON public.used_binance_order_ids
  FOR ALL
  USING (false);

CREATE POLICY "Admins can view used_binance_order_ids"
  ON public.used_binance_order_ids
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));
