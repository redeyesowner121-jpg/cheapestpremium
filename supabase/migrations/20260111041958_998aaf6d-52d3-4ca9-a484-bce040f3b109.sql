-- Add reseller_price column to product_variations
ALTER TABLE public.product_variations 
ADD COLUMN reseller_price NUMERIC;

-- Add a categories table to store predefined categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- Only admins can manage categories
CREATE POLICY "Only admins can manage categories" 
ON public.categories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Insert default categories including "Methods & Courses"
INSERT INTO public.categories (name, sort_order) VALUES
('OTT', 1),
('Music', 2),
('Tools', 3),
('Games', 4),
('Education', 5),
('Methods & Courses', 6)
ON CONFLICT (name) DO NOTHING;