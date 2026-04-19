
-- Netflix accounts (admin-managed pool)
CREATE TABLE public.netflix_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_users INTEGER NOT NULL DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.netflix_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage netflix_accounts" ON public.netflix_accounts
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Service role netflix_accounts" ON public.netflix_accounts
  FOR ALL USING (false);

-- Buyer ↔ Netflix account assignments
CREATE TABLE public.netflix_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  netflix_account_id UUID NOT NULL REFERENCES public.netflix_accounts(id) ON DELETE CASCADE,
  buyer_telegram_id BIGINT NOT NULL,
  order_id UUID,
  product_name TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_netflix_assignments_buyer ON public.netflix_assignments(buyer_telegram_id) WHERE is_active = true;
CREATE INDEX idx_netflix_assignments_account ON public.netflix_assignments(netflix_account_id) WHERE is_active = true;

ALTER TABLE public.netflix_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage netflix_assignments" ON public.netflix_assignments
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Service role netflix_assignments" ON public.netflix_assignments
  FOR ALL USING (false);

-- OTP forward history
CREATE TABLE public.netflix_otp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  netflix_account_id UUID REFERENCES public.netflix_accounts(id) ON DELETE SET NULL,
  netflix_email TEXT NOT NULL,
  otp_code TEXT,
  otp_link TEXT,
  email_subject TEXT,
  email_from TEXT,
  email_received_at TIMESTAMPTZ,
  forwarded_to_telegram_ids BIGINT[] DEFAULT '{}',
  forward_status TEXT NOT NULL DEFAULT 'pending',
  raw_message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_netflix_otp_logs_account ON public.netflix_otp_logs(netflix_account_id, created_at DESC);
CREATE INDEX idx_netflix_otp_logs_email ON public.netflix_otp_logs(netflix_email, created_at DESC);

ALTER TABLE public.netflix_otp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view netflix_otp_logs" ON public.netflix_otp_logs
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Service role netflix_otp_logs" ON public.netflix_otp_logs
  FOR ALL USING (false);

-- Bot users (subscribers of the Netflix bot)
CREATE TABLE public.netflix_bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.netflix_bot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view netflix_bot_users" ON public.netflix_bot_users
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Service role netflix_bot_users" ON public.netflix_bot_users
  FOR ALL USING (false);

-- Polling state (singleton)
CREATE TABLE public.netflix_bot_state (
  id INT PRIMARY KEY CHECK (id = 1),
  last_polled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_id TEXT,
  poll_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.netflix_bot_state (id, last_polled_at) VALUES (1, now() - INTERVAL '1 hour');

ALTER TABLE public.netflix_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view netflix_bot_state" ON public.netflix_bot_state
  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Service role netflix_bot_state" ON public.netflix_bot_state
  FOR ALL USING (false);

-- Auto-update updated_at
CREATE TRIGGER trg_netflix_accounts_updated
  BEFORE UPDATE ON public.netflix_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
