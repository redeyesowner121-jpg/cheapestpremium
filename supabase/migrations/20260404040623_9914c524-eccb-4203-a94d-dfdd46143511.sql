CREATE TABLE public.pending_razorpay_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  razorpay_order_id text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_razorpay_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposits" ON public.pending_razorpay_deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages deposits" ON public.pending_razorpay_deposits FOR ALL USING (false);