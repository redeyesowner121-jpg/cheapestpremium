CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  amount_usd NUMERIC,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'binance',
  product_id UUID REFERENCES public.products(id),
  variation_id UUID REFERENCES public.product_variations(id),
  product_name TEXT,
  telegram_user_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payments" ON public.payments FOR ALL USING (false);

CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update payments" ON public.payments FOR UPDATE USING (is_admin(auth.uid()));