
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id text,
  template_name text,
  recipient_email text NOT NULL,
  subject text,
  provider text NOT NULL DEFAULT 'gmail',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  order_id uuid,
  announcement_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_created_at ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_status ON public.email_send_log(status);
CREATE INDEX IF NOT EXISTS idx_email_send_log_template ON public.email_send_log(template_name);
CREATE INDEX IF NOT EXISTS idx_email_send_log_order ON public.email_send_log(order_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message_id ON public.email_send_log(message_id);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs"
  ON public.email_send_log FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update email logs"
  ON public.email_send_log FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete email logs"
  ON public.email_send_log FOR DELETE
  USING (public.is_admin(auth.uid()));
