-- Add telegram_id to profiles for proper bot↔website linking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_id_unique
  ON public.profiles(telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_bot_users_email
  ON public.telegram_bot_users(email)
  WHERE email IS NOT NULL AND email_verified = true;

-- Backfill: link existing accounts where bot user has a verified email matching a website profile
UPDATE public.profiles p
SET telegram_id = tbu.telegram_id
FROM public.telegram_bot_users tbu
WHERE tbu.email IS NOT NULL
  AND tbu.email_verified = true
  AND lower(tbu.email) = lower(p.email)
  AND p.telegram_id IS NULL;