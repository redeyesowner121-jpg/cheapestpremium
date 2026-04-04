
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  telegram_id bigint,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'upi',
  account_details text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own withdrawal requests" ON public.withdrawal_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can update withdrawal requests" ON public.withdrawal_requests
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Service role full access on withdrawals" ON public.withdrawal_requests
  FOR ALL USING (false);
