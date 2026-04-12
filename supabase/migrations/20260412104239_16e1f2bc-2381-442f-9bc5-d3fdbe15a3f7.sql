
-- 1. mother_bot_users
CREATE TABLE public.mother_bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mother_bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for mother_bot_users"
ON public.mother_bot_users FOR ALL TO public USING (false);

CREATE POLICY "Admins can view mother_bot_users"
ON public.mother_bot_users FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 2. child_bots
CREATE TABLE public.child_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token text NOT NULL,
  bot_username text,
  owner_telegram_id bigint NOT NULL,
  revenue_percent numeric NOT NULL DEFAULT 10 CHECK (revenue_percent >= 1 AND revenue_percent <= 60),
  is_active boolean NOT NULL DEFAULT true,
  total_earnings numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.child_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for child_bots"
ON public.child_bots FOR ALL TO public USING (false);

CREATE POLICY "Admins can view child_bots"
ON public.child_bots FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update child_bots"
ON public.child_bots FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. child_bot_users
CREATE TABLE public.child_bot_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_bot_id uuid NOT NULL REFERENCES public.child_bots(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  username text,
  first_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_bot_id, telegram_id)
);
ALTER TABLE public.child_bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for child_bot_users"
ON public.child_bot_users FOR ALL TO public USING (false);

CREATE POLICY "Admins can view child_bot_users"
ON public.child_bot_users FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. child_bot_orders
CREATE TABLE public.child_bot_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_bot_id uuid NOT NULL REFERENCES public.child_bots(id) ON DELETE CASCADE,
  main_order_id uuid,
  telegram_order_id uuid,
  buyer_telegram_id bigint NOT NULL,
  product_name text NOT NULL,
  total_price numeric NOT NULL DEFAULT 0,
  owner_commission numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.child_bot_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for child_bot_orders"
ON public.child_bot_orders FOR ALL TO public USING (false);

CREATE POLICY "Admins can view child_bot_orders"
ON public.child_bot_orders FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 5. child_bot_earnings
CREATE TABLE public.child_bot_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_bot_id uuid NOT NULL REFERENCES public.child_bots(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.child_bot_orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.child_bot_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for child_bot_earnings"
ON public.child_bot_earnings FOR ALL TO public USING (false);

CREATE POLICY "Admins can view child_bot_earnings"
ON public.child_bot_earnings FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update child_bot_earnings"
ON public.child_bot_earnings FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));
