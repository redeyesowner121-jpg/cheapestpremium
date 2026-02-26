
-- Table: telegram_bot_users
CREATE TABLE public.telegram_bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  username text,
  first_name text,
  last_name text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);

-- RLS enabled but no public policies (service role only)
ALTER TABLE public.telegram_bot_users ENABLE ROW LEVEL SECURITY;

-- Admin-only read access from web panel
CREATE POLICY "Admins can view telegram bot users"
  ON public.telegram_bot_users FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Table: telegram_orders
CREATE TABLE public.telegram_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  username text,
  product_name text,
  product_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  admin_message_id bigint,
  screenshot_file_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_orders ENABLE ROW LEVEL SECURITY;

-- Admin-only read access from web panel
CREATE POLICY "Admins can view telegram orders"
  ON public.telegram_orders FOR SELECT
  USING (public.is_admin(auth.uid()));
