-- Add column to track if discount/coupon was used on the order
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_applied numeric DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.orders.discount_applied IS 'Amount of discount/coupon applied. If > 0, no refund on cancellation';