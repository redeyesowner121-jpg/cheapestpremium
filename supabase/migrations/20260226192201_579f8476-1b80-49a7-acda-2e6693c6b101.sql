
-- Add language column to telegram_bot_users
ALTER TABLE public.telegram_bot_users ADD COLUMN IF NOT EXISTS language text DEFAULT NULL;

-- Create telegram_wallets table
CREATE TABLE public.telegram_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  referral_code text UNIQUE,
  referred_by bigint,
  is_reseller boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_wallets" ON public.telegram_wallets
  FOR ALL USING (false);

-- Create telegram_wallet_transactions table
CREATE TABLE public.telegram_wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_wallet_transactions" ON public.telegram_wallet_transactions
  FOR ALL USING (false);

-- Create telegram_resale_links table
CREATE TABLE public.telegram_resale_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_telegram_id bigint NOT NULL,
  product_id uuid NOT NULL,
  variation_id uuid,
  custom_price numeric NOT NULL,
  reseller_price numeric NOT NULL,
  link_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_resale_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_resale_links" ON public.telegram_resale_links
  FOR ALL USING (false);
