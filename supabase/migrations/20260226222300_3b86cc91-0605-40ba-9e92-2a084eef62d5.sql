
-- Table to store additional bot admins
CREATE TABLE public.telegram_bot_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  added_by bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_bot_admins"
  ON public.telegram_bot_admins FOR ALL
  USING (false);
