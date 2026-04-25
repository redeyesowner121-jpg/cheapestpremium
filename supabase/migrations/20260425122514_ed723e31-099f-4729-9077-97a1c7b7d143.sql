ALTER TABLE public.telegram_bot_users
  ADD COLUMN IF NOT EXISTS pending_email text,
  ADD COLUMN IF NOT EXISTS email_otp_code text,
  ADD COLUMN IF NOT EXISTS email_otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_otp_attempts integer NOT NULL DEFAULT 0;