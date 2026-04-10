
CREATE TABLE public.empty_cart_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.empty_cart_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active messages"
ON public.empty_cart_messages FOR SELECT
USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage messages"
ON public.empty_cart_messages FOR ALL
USING (is_admin(auth.uid()));
