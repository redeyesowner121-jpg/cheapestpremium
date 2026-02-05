-- Add guest checkout fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Make user_id nullable for guest orders
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow guest orders
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Guest orders can be created" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders by guest email" ON public.orders;

-- Allow authenticated users to create their own orders
CREATE POLICY "Users can create own orders" ON public.orders
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
  (user_id IS NULL AND guest_email IS NOT NULL)
);

-- Allow users to view their own orders (authenticated or by guest email match handled in app)
CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
  is_admin(auth.uid()) OR
  user_id IS NULL
);