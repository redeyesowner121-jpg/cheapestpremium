-- Create seller_products table for seller-specific products
CREATE TABLE IF NOT EXISTS public.seller_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  image_url TEXT,
  access_link TEXT,
  is_active BOOLEAN DEFAULT true,
  rating NUMERIC DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create seller_product_variations table
CREATE TABLE IF NOT EXISTS public.seller_product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_status_history table for tracking
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Seller products policies
CREATE POLICY "Anyone can view active seller products"
ON public.seller_products FOR SELECT
USING (is_active = true OR auth.uid() = seller_id OR is_admin(auth.uid()));

CREATE POLICY "Sellers can manage own products"
ON public.seller_products FOR ALL
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage all seller products"
ON public.seller_products FOR ALL
USING (is_admin(auth.uid()));

-- Seller product variations policies
CREATE POLICY "Anyone can view active seller variations"
ON public.seller_product_variations FOR SELECT
USING (is_active = true OR EXISTS (
  SELECT 1 FROM public.seller_products sp WHERE sp.id = product_id AND sp.seller_id = auth.uid()
) OR is_admin(auth.uid()));

CREATE POLICY "Sellers can manage own product variations"
ON public.seller_product_variations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.seller_products sp WHERE sp.id = product_id AND sp.seller_id = auth.uid()
));

-- Order status history policies
CREATE POLICY "Users can view own order history"
ON public.order_status_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
));

CREATE POLICY "Admins can insert order history"
ON public.order_status_history FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can insert own order history"
ON public.order_status_history FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()
));

-- Add trigger for updated_at on seller_products
CREATE TRIGGER update_seller_products_updated_at
BEFORE UPDATE ON public.seller_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for order_status_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;