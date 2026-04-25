ALTER TABLE public.order_reports
  ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;