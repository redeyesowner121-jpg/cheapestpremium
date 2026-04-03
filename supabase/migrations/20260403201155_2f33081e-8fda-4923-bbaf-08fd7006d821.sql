CREATE TABLE IF NOT EXISTS public.telegram_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  code text NOT NULL UNIQUE,
  username text,
  first_name text,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_login_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'telegram_login_codes' AND policyname = 'Service role only for telegram_login_codes'
  ) THEN
    CREATE POLICY "Service role only for telegram_login_codes"
      ON public.telegram_login_codes FOR ALL USING (false);
  END IF;
END $$;