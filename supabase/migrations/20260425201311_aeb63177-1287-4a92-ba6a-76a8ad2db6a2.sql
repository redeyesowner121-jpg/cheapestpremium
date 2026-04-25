-- Create reseller applications table
CREATE TABLE public.reseller_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  application_type TEXT NOT NULL CHECK (application_type IN ('reseller', 'wholesaler')),
  proof_image_url TEXT,
  proof_telegram_file_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_reseller_apps_telegram ON public.reseller_applications(telegram_id);
CREATE INDEX idx_reseller_apps_status ON public.reseller_applications(status);

ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reseller applications"
ON public.reseller_applications FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role reseller applications"
ON public.reseller_applications FOR ALL
USING (false);

CREATE TRIGGER update_reseller_apps_updated_at
BEFORE UPDATE ON public.reseller_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for proof uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('reseller-proofs', 'reseller-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read reseller proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'reseller-proofs');

CREATE POLICY "Admins manage reseller proofs"
ON storage.objects FOR ALL
USING (bucket_id = 'reseller-proofs' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'reseller-proofs' AND is_admin(auth.uid()));