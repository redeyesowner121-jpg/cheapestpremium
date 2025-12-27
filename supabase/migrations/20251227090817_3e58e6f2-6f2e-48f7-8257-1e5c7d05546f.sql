-- Create direct messages table for user-to-user messaging
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own conversations (sent or received)
CREATE POLICY "Users can view their own messages" 
ON public.direct_messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages" 
ON public.direct_messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "Users can update received messages" 
ON public.direct_messages 
FOR UPDATE 
USING (auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Update products RLS to allow delete for admins
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
USING (is_admin(auth.uid()));

-- Also fix banners, flash_sales if they have similar issues
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Admins can manage banners" 
ON public.banners 
FOR ALL 
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage flash sales" ON public.flash_sales;
CREATE POLICY "Admins can manage flash sales" 
ON public.flash_sales 
FOR ALL 
USING (is_admin(auth.uid()));