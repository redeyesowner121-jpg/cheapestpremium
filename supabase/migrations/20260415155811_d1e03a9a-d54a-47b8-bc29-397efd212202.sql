
CREATE TABLE public.child_bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_bot_id uuid NOT NULL REFERENCES public.child_bots(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_bot_id, key)
);

ALTER TABLE public.child_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for child_bot_settings"
  ON public.child_bot_settings FOR ALL
  USING (false);

CREATE POLICY "Admins can view child_bot_settings"
  ON public.child_bot_settings FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage child_bot_settings"
  ON public.child_bot_settings FOR ALL TO authenticated
  USING (is_admin(auth.uid()));
