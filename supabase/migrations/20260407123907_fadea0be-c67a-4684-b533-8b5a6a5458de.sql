
-- Giveaway products (linked to existing products)
CREATE TABLE public.giveaway_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES public.product_variations(id) ON DELETE SET NULL,
  points_required INTEGER NOT NULL DEFAULT 10,
  stock INTEGER DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Giveaway referral points per user
CREATE TABLE public.giveaway_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(telegram_id)
);

-- Giveaway referral tracking
CREATE TABLE public.giveaway_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_telegram_id BIGINT NOT NULL,
  referred_telegram_id BIGINT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_telegram_id)
);

-- Giveaway redemption requests
CREATE TABLE public.giveaway_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  giveaway_product_id UUID NOT NULL REFERENCES public.giveaway_products(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Giveaway settings
CREATE TABLE public.giveaway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.giveaway_settings (key, value) VALUES
  ('points_per_referral', '2'),
  ('bot_welcome_message', '🎁 Welcome to our Giveaway Bot! Refer friends and win free products!'),
  ('bot_welcome_message_bn', '🎁 আমাদের গিভওয়ে বটে স্বাগতম! বন্ধুদের রেফার করুন এবং ফ্রি প্রোডাক্ট জিতুন!');

-- RLS
ALTER TABLE public.giveaway_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_settings ENABLE ROW LEVEL SECURITY;

-- All giveaway tables: service role only (accessed via edge functions)
CREATE POLICY "Service role only for giveaway_products" ON public.giveaway_products FOR ALL USING (false);
CREATE POLICY "Admins can manage giveaway_products" ON public.giveaway_products FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view active giveaway_products" ON public.giveaway_products FOR SELECT USING (is_active = true);

CREATE POLICY "Service role only for giveaway_points" ON public.giveaway_points FOR ALL USING (false);
CREATE POLICY "Service role only for giveaway_referrals" ON public.giveaway_referrals FOR ALL USING (false);
CREATE POLICY "Service role only for giveaway_redemptions" ON public.giveaway_redemptions FOR ALL USING (false);
CREATE POLICY "Admins can manage giveaway_redemptions" ON public.giveaway_redemptions FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view giveaway_redemptions" ON public.giveaway_redemptions FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Service role only for giveaway_settings" ON public.giveaway_settings FOR ALL USING (false);
CREATE POLICY "Admins can manage giveaway_settings" ON public.giveaway_settings FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Anyone can view giveaway_settings" ON public.giveaway_settings FOR SELECT USING (true);
