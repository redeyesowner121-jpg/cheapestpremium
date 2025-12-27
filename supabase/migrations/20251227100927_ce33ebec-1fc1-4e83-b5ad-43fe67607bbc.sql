-- Add seller_id and withdrawable columns to orders for payment hold system
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS is_withdrawable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS buyer_confirmed boolean DEFAULT false;

-- Add pending_balance to profiles for seller withdrawable amount tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_balance numeric DEFAULT 0;

-- Add platform_fee tracking to transactions
-- Update: Track commission separately in transactions table through description