/*
  # Create Telegram Bot Infrastructure Tables
  
  1. New Tables
    - `telegram_bot_users` - Telegram users registry
    - `telegram_wallets` - User wallet balances
    - `telegram_orders` - Purchase orders from telegram
    - `telegram_bot_admins` - Bot admin users
    - `telegram_conversation_state` - Multi-step conversation tracking
    - `telegram_wallet_transactions` - Wallet transaction history
    - `telegram_resale_links` - Resale link codes and tracking
    - `telegram_required_channels` - Channel membership requirements
    
  2. Security
    - Enable RLS on all tables
    - Service role access only for most tables
    - Restrict policies as needed
    
  3. Initial Data
    - Set up bot owner (7170630274) as admin
*/

-- Table: telegram_bot_users
CREATE TABLE IF NOT EXISTS public.telegram_bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  username text,
  first_name text,
  last_name text,
  language text DEFAULT 'en',
  is_banned boolean NOT NULL DEFAULT false,
  role text DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_bot_users"
  ON public.telegram_bot_users FOR ALL
  USING (false);

-- Table: telegram_wallets
CREATE TABLE IF NOT EXISTS public.telegram_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  balance numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  referral_code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_wallets"
  ON public.telegram_wallets FOR ALL
  USING (false);

-- Table: telegram_orders
CREATE TABLE IF NOT EXISTS public.telegram_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  username text,
  product_name text,
  product_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  admin_message_id bigint,
  screenshot_file_id text,
  reseller_telegram_id bigint,
  reseller_profit numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_orders"
  ON public.telegram_orders FOR ALL
  USING (false);

-- Table: telegram_bot_admins
CREATE TABLE IF NOT EXISTS public.telegram_bot_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  role text DEFAULT 'admin',
  added_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_bot_admins"
  ON public.telegram_bot_admins FOR ALL
  USING (false);

-- Table: telegram_conversation_state
CREATE TABLE IF NOT EXISTS public.telegram_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  step text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_conversation_state"
  ON public.telegram_conversation_state FOR ALL
  USING (false);

-- Table: telegram_wallet_transactions
CREATE TABLE IF NOT EXISTS public.telegram_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_wallet_transactions"
  ON public.telegram_wallet_transactions FOR ALL
  USING (false);

-- Table: telegram_resale_links
CREATE TABLE IF NOT EXISTS public.telegram_resale_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_telegram_id bigint NOT NULL,
  product_id uuid NOT NULL,
  variation_id uuid,
  link_code text NOT NULL UNIQUE,
  custom_price numeric NOT NULL,
  reseller_price numeric NOT NULL,
  is_active boolean DEFAULT true,
  uses integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_resale_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_resale_links"
  ON public.telegram_resale_links FOR ALL
  USING (false);

-- Table: telegram_required_channels
CREATE TABLE IF NOT EXISTS public.telegram_required_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_required_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_required_channels"
  ON public.telegram_required_channels FOR ALL
  USING (false);

-- Initialize bot owner as admin
INSERT INTO public.telegram_bot_users (telegram_id, first_name, username, language, role)
VALUES (7170630274, 'Owner', NULL, 'en', 'owner')
ON CONFLICT (telegram_id) DO UPDATE
SET role = 'owner', language = 'en';

-- Add bot owner as admin
INSERT INTO public.telegram_bot_admins (telegram_id, role, added_by)
VALUES (7170630274, 'owner', 7170630274)
ON CONFLICT (telegram_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_bot_users_telegram_id ON public.telegram_bot_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_wallets_telegram_id ON public.telegram_wallets(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_orders_telegram_user_id ON public.telegram_orders(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_admins_telegram_id ON public.telegram_bot_admins(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_resale_links_code ON public.telegram_resale_links(link_code);
