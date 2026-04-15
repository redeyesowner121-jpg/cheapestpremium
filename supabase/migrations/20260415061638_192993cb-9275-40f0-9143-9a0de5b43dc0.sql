
CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  subdomain text,
  referrer text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking visits without auth)
CREATE POLICY "Anyone can log visits" ON public.site_visits FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admins can view visits
CREATE POLICY "Admins can view visits" ON public.site_visits FOR SELECT TO authenticated USING (is_admin(auth.uid()));
