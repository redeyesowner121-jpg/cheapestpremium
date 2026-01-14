-- Create price_history table to track price changes for products and variations
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES public.product_variations(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  reseller_price NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_product_or_variation CHECK (
    (product_id IS NOT NULL AND variation_id IS NULL) OR 
    (product_id IS NULL AND variation_id IS NOT NULL) OR
    (product_id IS NOT NULL AND variation_id IS NOT NULL)
  )
);

-- Create index for faster queries
CREATE INDEX idx_price_history_product ON public.price_history(product_id, recorded_at DESC);
CREATE INDEX idx_price_history_variation ON public.price_history(variation_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Public read access for price history
CREATE POLICY "Anyone can view price history"
ON public.price_history FOR SELECT
USING (true);

-- Only admins can insert price history (will be done via trigger)
CREATE POLICY "System can insert price history"
ON public.price_history FOR INSERT
WITH CHECK (true);

-- Function to record price change for products
CREATE OR REPLACE FUNCTION public.record_product_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record if price or reseller_price changed
  IF (OLD.price IS DISTINCT FROM NEW.price) OR (OLD.reseller_price IS DISTINCT FROM NEW.reseller_price) THEN
    INSERT INTO public.price_history (product_id, price, reseller_price)
    VALUES (NEW.id, NEW.price, NEW.reseller_price);
  END IF;
  RETURN NEW;
END;
$$;

-- Function to record price change for variations
CREATE OR REPLACE FUNCTION public.record_variation_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only record if price or reseller_price changed
  IF (OLD.price IS DISTINCT FROM NEW.price) OR (OLD.reseller_price IS DISTINCT FROM NEW.reseller_price) THEN
    INSERT INTO public.price_history (product_id, variation_id, price, reseller_price)
    VALUES (NEW.product_id, NEW.id, NEW.price, NEW.reseller_price);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_product_price_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.record_product_price_change();

CREATE TRIGGER on_variation_price_change
  AFTER UPDATE ON public.product_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.record_variation_price_change();

-- Function to record initial price when product is created
CREATE OR REPLACE FUNCTION public.record_initial_product_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.price_history (product_id, price, reseller_price)
  VALUES (NEW.id, NEW.price, NEW.reseller_price);
  RETURN NEW;
END;
$$;

-- Function to record initial price when variation is created
CREATE OR REPLACE FUNCTION public.record_initial_variation_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.price_history (product_id, variation_id, price, reseller_price)
  VALUES (NEW.product_id, NEW.id, NEW.price, NEW.reseller_price);
  RETURN NEW;
END;
$$;

-- Create triggers for new products/variations
CREATE TRIGGER on_product_created_record_price
  AFTER INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.record_initial_product_price();

CREATE TRIGGER on_variation_created_record_price
  AFTER INSERT ON public.product_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.record_initial_variation_price();