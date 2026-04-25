CREATE TABLE public.order_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  admin_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_reports_order_id ON public.order_reports(order_id);
CREATE INDEX idx_order_reports_user_id ON public.order_reports(user_id);
CREATE INDEX idx_order_reports_status ON public.order_reports(status);

ALTER TABLE public.order_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own order reports"
ON public.order_reports FOR INSERT
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can view own order reports"
ON public.order_reports FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can update order reports"
ON public.order_reports FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete order reports"
ON public.order_reports FOR DELETE
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_order_reports_updated_at
BEFORE UPDATE ON public.order_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();