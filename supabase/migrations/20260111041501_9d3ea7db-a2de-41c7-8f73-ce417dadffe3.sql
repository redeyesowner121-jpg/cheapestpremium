-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create payment_settings table for admin to manage payment options
CREATE TABLE public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read payment settings
CREATE POLICY "Anyone can view payment settings" 
ON public.payment_settings 
FOR SELECT 
USING (true);

-- Only admins can update payment settings
CREATE POLICY "Only admins can update payment settings" 
ON public.payment_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Only admins can insert payment settings
CREATE POLICY "Only admins can insert payment settings" 
ON public.payment_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Insert default settings
INSERT INTO public.payment_settings (setting_key, setting_value, is_enabled) VALUES
('automatic_payment', NULL, true),
('manual_payment_qr', NULL, true),
('manual_payment_link', NULL, true),
('manual_payment_instructions', 'পেমেন্ট করার পর Transaction ID দিয়ে রিকোয়েস্ট সাবমিট করুন।', true);

-- Create manual_deposit_requests table
CREATE TABLE public.manual_deposit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_id TEXT NOT NULL,
  payment_method TEXT DEFAULT 'qr',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_deposit_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own deposit requests" 
ON public.manual_deposit_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create their own deposit requests" 
ON public.manual_deposit_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all deposit requests" 
ON public.manual_deposit_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Admins can update requests
CREATE POLICY "Admins can update deposit requests" 
ON public.manual_deposit_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Create updated_at triggers
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_manual_deposit_requests_updated_at
BEFORE UPDATE ON public.manual_deposit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();