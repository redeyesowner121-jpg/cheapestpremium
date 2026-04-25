ALTER TABLE public.telegram_bot_users 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='telegram_bot_users' 
      AND policyname='Admins can view telegram_bot_users emails'
  ) THEN
    CREATE POLICY "Admins can view telegram_bot_users emails"
      ON public.telegram_bot_users
      FOR SELECT
      TO authenticated
      USING (is_admin(auth.uid()));
  END IF;
END$$;