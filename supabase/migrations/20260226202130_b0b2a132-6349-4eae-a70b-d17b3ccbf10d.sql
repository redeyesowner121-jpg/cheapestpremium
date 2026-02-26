
-- Add resale tracking columns to telegram_orders
ALTER TABLE public.telegram_orders
ADD COLUMN reseller_telegram_id bigint DEFAULT NULL,
ADD COLUMN reseller_profit numeric DEFAULT NULL;
