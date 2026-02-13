-- Create trigger for product price changes
CREATE TRIGGER track_product_price_change
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.record_product_price_change();

-- Create trigger for initial product price
CREATE TRIGGER track_initial_product_price
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.record_initial_product_price();

-- Create trigger for variation price changes
CREATE TRIGGER track_variation_price_change
AFTER UPDATE ON public.product_variations
FOR EACH ROW
EXECUTE FUNCTION public.record_variation_price_change();

-- Create trigger for initial variation price
CREATE TRIGGER track_initial_variation_price
AFTER INSERT ON public.product_variations
FOR EACH ROW
EXECUTE FUNCTION public.record_initial_variation_price();