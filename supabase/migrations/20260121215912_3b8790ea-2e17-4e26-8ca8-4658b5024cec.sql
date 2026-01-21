-- Create redeem_codes table for wallet gift codes
CREATE TABLE public.redeem_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create redeem_code_usage table to track who used which code
CREATE TABLE public.redeem_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index to prevent same user from using same code twice
CREATE UNIQUE INDEX idx_redeem_code_user ON public.redeem_code_usage(code_id, user_id);

-- Enable RLS
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_code_usage ENABLE ROW LEVEL SECURITY;

-- Redeem codes policies
CREATE POLICY "Admins can manage redeem codes"
  ON public.redeem_codes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'temp_admin')
  ));

CREATE POLICY "Anyone can view active redeem codes"
  ON public.redeem_codes FOR SELECT
  USING (is_active = true);

-- Redeem code usage policies
CREATE POLICY "Users can insert their own usage"
  ON public.redeem_code_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage"
  ON public.redeem_code_usage FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'temp_admin')
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_redeem_codes_updated_at
  BEFORE UPDATE ON public.redeem_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();