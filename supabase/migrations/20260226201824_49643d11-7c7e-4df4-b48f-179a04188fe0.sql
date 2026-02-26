
-- Create resale_links table for web reseller system
CREATE TABLE public.resale_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  custom_price numeric NOT NULL,
  reseller_price numeric NOT NULL,
  link_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resale_links ENABLE ROW LEVEL SECURITY;

-- Resellers can manage their own links
CREATE POLICY "Resellers can manage own links"
ON public.resale_links
FOR ALL
USING (auth.uid() = reseller_id);

-- Anyone can view active links (needed for the purchase flow)
CREATE POLICY "Anyone can view active resale links"
ON public.resale_links
FOR SELECT
USING (is_active = true);
