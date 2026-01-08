-- Add rank system columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rank_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_reseller BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_rank_decay TIMESTAMPTZ DEFAULT NULL;

-- Add reseller_price to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS reseller_price NUMERIC DEFAULT NULL;

-- Add reseller_price to seller_products as well
ALTER TABLE public.seller_products 
ADD COLUMN IF NOT EXISTS reseller_price NUMERIC DEFAULT NULL;

-- Initialize rank_balance from total_deposit for existing users
UPDATE public.profiles 
SET rank_balance = COALESCE(total_deposit, 0) 
WHERE rank_balance = 0 OR rank_balance IS NULL;