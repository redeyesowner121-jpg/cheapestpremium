-- ============================================================================
-- PHASE 1: System Config tables
-- ============================================================================

-- 1) Email templates table (DB-driven email content)
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,            -- e.g. 'order_confirmed', 'order_pending', 'order_cancelled'
  display_name text NOT NULL,                   -- human-readable name for admin UI
  subject text NOT NULL,                        -- supports {{variable}} placeholders
  html_body text NOT NULL,                      -- supports {{variable}} placeholders
  text_body text,                               -- optional plain text version
  variables jsonb DEFAULT '[]'::jsonb,          -- list of available placeholders for docs
  is_active boolean DEFAULT true,
  description text,                             -- internal note
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active email templates"
  ON public.email_templates FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage email templates"
  ON public.email_templates FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Bot texts table (DB-driven Telegram bot copy)
CREATE TABLE IF NOT EXISTS public.bot_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_key text NOT NULL,                       -- e.g. 'welcome', 'help', 'btn_my_orders'
  language text NOT NULL DEFAULT 'en',          -- 'en', 'bn'
  content text NOT NULL,                        -- the actual text (supports {{variable}})
  category text DEFAULT 'general',              -- 'welcome', 'menu', 'order', 'wallet', 'error'
  description text,                             -- internal note
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (text_key, language)
);

ALTER TABLE public.bot_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bot texts"
  ON public.bot_texts FOR SELECT
  USING (is_active = true OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage bot texts"
  ON public.bot_texts FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_bot_texts_updated_at
  BEFORE UPDATE ON public.bot_texts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bot_texts_key_lang ON public.bot_texts (text_key, language);
CREATE INDEX IF NOT EXISTS idx_bot_texts_category ON public.bot_texts (category);

-- 3) Seed app_settings with branding, contact, business rules
INSERT INTO public.app_settings (key, value) VALUES
  -- Branding
  ('app_name', 'Cheapest Premiums'),
  ('app_tagline', 'Premium Subscriptions • Instant Delivery'),
  ('app_url', 'https://cheapest-premiums.in'),
  ('app_logo_url', ''),
  ('brand_primary_color', '#6366f1'),
  ('brand_dark_color', '#0f172a'),
  -- Contact
  ('support_email', 'support@cheapest-premiums.in'),
  ('admin_alert_email', 'red.eyes.owner121@gmail.com'),
  ('support_telegram', '@RKRxSupport'),
  ('proofs_channel', '@RKRxProofs'),
  -- Business rules (numeric stored as text)
  ('escrow_fee_percent', '2'),
  ('seller_commission_percent', '10'),
  ('foreign_currency_fee_percent', '30'),
  ('bulk_discount_percent', '8'),
  ('bulk_discount_min_qty', '5'),
  ('min_withdrawal_amount', '50'),
  ('min_deposit_amount', '10'),
  ('escrow_expiry_minutes', '30'),
  ('binance_reservation_minutes', '20'),
  ('razorpay_reservation_minutes', '10'),
  ('aax_conversion_fee_percent', '0'),
  -- Email
  ('email_from_name', 'Cheapest Premiums'),
  ('email_from_address', 'support@cheapest-premiums.in')
ON CONFLICT (key) DO NOTHING;

-- 4) Seed essential email templates (initial set — can be edited by admin later)
INSERT INTO public.email_templates (template_key, display_name, subject, html_body, variables, description) VALUES
  ('order_confirmed',
   'Order Confirmed',
   '✅ Order Confirmed — {{productName}} (#{{shortId}})',
   '<p>Hi {{customerName}},</p><p>Your order for <b>{{productName}}</b> is confirmed.</p><p>Order ID: <code>#{{shortId}}</code><br>Total: {{currency}}{{totalPrice}}</p>{{#accessLink}}<p><a href="{{accessLink}}">Open Access</a></p>{{/accessLink}}',
   '["customerName","productName","shortId","totalPrice","currency","accessLink","quantity","appName"]'::jsonb,
   'Sent when an order is confirmed / instantly delivered'),
  ('order_pending',
   'Order Placed (Pending)',
   '🛒 Order Received — {{productName}} (#{{shortId}})',
   '<p>Hi {{customerName}},</p><p>We received your order for <b>{{productName}}</b> and our team is processing it now.</p><p>Order ID: <code>#{{shortId}}</code></p>',
   '["customerName","productName","shortId","totalPrice","currency","quantity","appName"]'::jsonb,
   'Sent when an order is placed and awaiting confirmation'),
  ('order_cancelled',
   'Order Cancelled',
   '❌ Order Cancelled — {{productName}} (#{{shortId}})',
   '<p>Hi {{customerName}},</p><p>Your order for <b>{{productName}}</b> has been cancelled. {{refundNote}}</p>',
   '["customerName","productName","shortId","totalPrice","currency","refundNote","appName"]'::jsonb,
   'Sent when an order is cancelled by admin/user'),
  ('order_refunded',
   'Order Refunded',
   '💰 Refund Processed — {{productName}} (#{{shortId}})',
   '<p>Hi {{customerName}},</p><p>Your refund of {{currency}}{{totalPrice}} has been credited to your wallet.</p>',
   '["customerName","productName","shortId","totalPrice","currency","appName"]'::jsonb,
   'Sent when a refund is processed'),
  ('email_verification',
   'Email Verification Code',
   'Your verification code: {{code}}',
   '<p>Hi,</p><p>Your verification code is: <b style="font-size:24px;">{{code}}</b></p><p>This code expires in 10 minutes.</p>',
   '["code","appName"]'::jsonb,
   'Sent for email OTP verification (Telegram link, etc.)')
ON CONFLICT (template_key) DO NOTHING;

-- 5) Seed essential bot texts (English)
INSERT INTO public.bot_texts (text_key, language, content, category, description) VALUES
  ('welcome', 'en', '👋 Welcome to {{appName}}!\n\nGet premium subscriptions at the cheapest prices with instant delivery.', 'welcome', 'Bot /start welcome message'),
  ('welcome', 'bn', '👋 {{appName}} এ স্বাগতম!\n\nসবচেয়ে সস্তায় প্রিমিয়াম সাবস্ক্রিপশন পান, ইনস্ট্যান্ট ডেলিভারি সহ।', 'welcome', 'Bot /start welcome message (Bangla)'),
  ('help', 'en', 'ℹ️ Available commands:\n/start - Main menu\n/myorders - Your orders\n/wallet - Check balance\n/products - Browse products\n/support - Contact support', 'menu', 'Help command'),
  ('btn_my_orders', 'en', '📦 My Orders', 'menu', 'Button label'),
  ('btn_wallet', 'en', '💰 Wallet', 'menu', 'Button label'),
  ('btn_products', 'en', '🛍️ Products', 'menu', 'Button label'),
  ('btn_support', 'en', '🆘 Support', 'menu', 'Button label'),
  ('order_success', 'en', '✅ Order placed successfully! Order ID: #{{shortId}}', 'order', 'Order placement success'),
  ('insufficient_balance', 'en', '⚠️ Insufficient wallet balance. Please top up your wallet first.', 'wallet', 'Low balance error'),
  ('payment_pending', 'en', '⏳ Payment is pending. Please wait while we verify.', 'wallet', 'Payment pending message')
ON CONFLICT (text_key, language) DO NOTHING;