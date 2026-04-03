CREATE TABLE public.telegram_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  username text,
  first_name text,
  code text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_login_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_login_codes"
  ON public.telegram_login_codes
  FOR ALL
  USING (false);