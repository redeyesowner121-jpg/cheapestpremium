CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 465,
  secure boolean NOT NULL DEFAULT true,
  username text NOT NULL,
  password text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL DEFAULT 'Cheapest Premiums',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smtp settings"
  ON public.smtp_settings
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER update_smtp_settings_updated_at
  BEFORE UPDATE ON public.smtp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();