-- Add image_url column to chat_messages for photo sharing
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create product_variations table
CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_variations
CREATE POLICY "Anyone can view active variations" 
ON public.product_variations 
FOR SELECT 
USING ((is_active = true) OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage variations" 
ON public.product_variations 
FOR ALL 
USING (is_admin(auth.uid()));