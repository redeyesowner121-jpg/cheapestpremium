
-- Create currencies table for admin-managed currency conversion rates
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '$',
  flag TEXT DEFAULT '🏳️',
  rate_to_inr NUMERIC NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Anyone can view active currencies
CREATE POLICY "Anyone can view active currencies"
ON public.currencies FOR SELECT
USING (is_active = true OR is_admin(auth.uid()));

-- Admins can manage currencies
CREATE POLICY "Admins can manage currencies"
ON public.currencies FOR ALL
USING (is_admin(auth.uid()));

-- Insert default currencies
INSERT INTO public.currencies (code, name, symbol, flag, rate_to_inr, sort_order) VALUES
('INR', 'Indian Rupee', '₹', '🇮🇳', 1, 0),
('USD', 'US Dollar', '$', '🇺🇸', 95, 1),
('EUR', 'Euro', '€', '🇪🇺', 103, 2),
('GBP', 'British Pound', '£', '🇬🇧', 120, 3),
('BDT', 'Bangladeshi Taka', '৳', '🇧🇩', 0.79, 4);
