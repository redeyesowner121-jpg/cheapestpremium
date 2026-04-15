
-- Add delivery_mode to products
ALTER TABLE public.products ADD COLUMN delivery_mode text NOT NULL DEFAULT 'repeated';

-- Create stock items table for unique delivery
CREATE TABLE public.product_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  access_link text NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  telegram_order_id uuid REFERENCES public.telegram_orders(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_stock_items ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage stock items"
ON public.product_stock_items
FOR ALL
USING (is_admin(auth.uid()));

-- Service role access (for edge functions)
CREATE POLICY "Service role full access on stock items"
ON public.product_stock_items
FOR ALL
USING (false);

-- Index for quick lookup of available stock
CREATE INDEX idx_stock_items_available ON public.product_stock_items (product_id, is_used) WHERE is_used = false;
