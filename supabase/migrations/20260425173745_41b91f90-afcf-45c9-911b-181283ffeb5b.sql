
-- 1) Add expires_at column for pending_acceptance deals (default 30 min)
ALTER TABLE public.escrow_deals
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing pending deals
UPDATE public.escrow_deals
SET expires_at = created_at + interval '30 minutes'
WHERE expires_at IS NULL;

-- 2) Update create_escrow_deal to set expires_at
CREATE OR REPLACE FUNCTION public.create_escrow_deal(_buyer_id uuid, _seller_email text, _amount numeric, _description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id uuid; v_seller_name text;
  v_buyer_balance numeric; v_buyer_name text;
  v_fee numeric; v_seller_amt numeric; v_id uuid;
BEGIN
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _description IS NULL OR length(trim(_description)) < 5 THEN RAISE EXCEPTION 'Please describe the deal (min 5 chars)'; END IF;
  SELECT id, name INTO v_seller_id, v_seller_name FROM profiles WHERE lower(email) = lower(trim(_seller_email)) LIMIT 1;
  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  IF v_seller_id = _buyer_id THEN RAISE EXCEPTION 'Cannot create deal with yourself'; END IF;
  SELECT wallet_balance, name INTO v_buyer_balance, v_buyer_name FROM profiles WHERE id = _buyer_id;
  IF v_buyer_balance < _amount THEN RAISE EXCEPTION 'Insufficient balance to fund this escrow'; END IF;

  v_fee := round((_amount * 0.02)::numeric, 2);
  v_seller_amt := _amount - v_fee;

  INSERT INTO escrow_deals (buyer_id, seller_id, amount, fee_amount, seller_amount, description, status, expires_at)
  VALUES (_buyer_id, v_seller_id, _amount, v_fee, v_seller_amt, _description, 'pending_acceptance', now() + interval '30 minutes')
  RETURNING id INTO v_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_seller_id, 'New Escrow Request 🤝',
    COALESCE(v_buyer_name,'A buyer') || ' wants to start an escrow of ₹' || _amount::text || '. Accept within 30 minutes.',
    'wallet');

  INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (v_id, _buyer_id, 'system', 'Escrow created. Auto-expires in 30 minutes if not accepted.');

  RETURN jsonb_build_object('success', true, 'deal_id', v_id, 'seller_amount', v_seller_amt, 'fee', v_fee, 'status', 'pending_acceptance');
END;
$function$;

-- 3) Auto-expire stale pending escrows (called by cron)
CREATE OR REPLACE FUNCTION public.expire_stale_escrows()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD; v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM escrow_deals
    WHERE status = 'pending_acceptance'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    FOR UPDATE
  LOOP
    UPDATE escrow_deals
    SET status = 'cancelled', admin_resolution = 'auto_expired_30min'
    WHERE id = r.id;

    INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
    VALUES (r.id, r.buyer_id, 'system', '⏱️ Escrow auto-cancelled — seller did not accept within 30 minutes.');

    INSERT INTO notifications (user_id, title, message, type)
    VALUES
      (r.buyer_id, 'Escrow Expired ⏱️', 'Your escrow request expired (30 min). No funds were charged.', 'wallet'),
      (r.seller_id, 'Escrow Expired ⏱️', 'An escrow request expired before you accepted.', 'wallet');

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count);
END;
$function$;

-- 4) Buyer cancel for FUNDED (not yet delivered) — refunds buyer
CREATE OR REPLACE FUNCTION public.buyer_cancel_funded_escrow(_buyer_id uuid, _deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND buyer_id = _buyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status <> 'funded' THEN RAISE EXCEPTION 'Can only cancel before delivery'; END IF;

  -- Refund buyer
  UPDATE profiles SET wallet_balance = wallet_balance + r.amount WHERE id = r.buyer_id;
  UPDATE escrow_deals SET status='cancelled', admin_resolution='buyer_cancelled_before_delivery', completed_at=now() WHERE id=_deal_id;

  -- Mark hold transaction as refunded
  UPDATE transactions SET status='completed', type='escrow_refunded', description='Escrow cancelled by buyer: ' || r.description
    WHERE user_id = r.buyer_id AND type='escrow_hold' AND status='pending' AND amount = -r.amount;

  INSERT INTO transactions (user_id, type, amount, status, description)
  VALUES (r.buyer_id, 'refund', r.amount, 'completed', 'Escrow cancelled - refund: ' || r.description);

  INSERT INTO notifications (user_id, title, message, type)
  VALUES
    (r.seller_id, 'Escrow Cancelled', 'Buyer cancelled the escrow before delivery.', 'wallet'),
    (r.buyer_id, 'Escrow Refunded', '₹' || r.amount::text || ' returned to your wallet.', 'wallet');

  INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (_deal_id, _buyer_id, 'system', '❌ Buyer cancelled before delivery. Funds refunded.');

  RETURN jsonb_build_object('success', true, 'refunded', r.amount);
END;
$function$;

-- 5) Filter contact info from escrow messages (trigger BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.filter_escrow_message_contacts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_text text;
BEGIN
  -- Allow system messages to pass through
  IF NEW.sender_role = 'system' THEN RETURN NEW; END IF;

  -- Block messages on closed/expired deals
  SELECT status INTO v_status FROM escrow_deals WHERE id = NEW.deal_id;
  IF v_status IN ('completed','refunded','cancelled') THEN
    RAISE EXCEPTION 'Deal is closed — no new messages allowed';
  END IF;

  v_text := lower(NEW.message);

  -- Email pattern
  IF v_text ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RAISE EXCEPTION 'Sharing email addresses is not allowed in escrow chat';
  END IF;

  -- Phone pattern (7+ consecutive digits, optionally with +/-/space)
  IF v_text ~ '(\+?\d[\d\s\-]{6,}\d)' THEN
    RAISE EXCEPTION 'Sharing phone numbers is not allowed in escrow chat';
  END IF;

  -- Telegram/WhatsApp/social handles or invite links
  IF v_text ~ '(t\.me/|telegram\.me/|wa\.me/|whatsapp|@[a-z0-9_]{4,}|instagram\.com/|fb\.com/|facebook\.com/|discord\.gg/|chat\.whatsapp)' THEN
    RAISE EXCEPTION 'Sharing usernames or external chat links is not allowed in escrow chat';
  END IF;

  -- URL patterns (any external link)
  IF v_text ~ '(https?://|www\.)' THEN
    RAISE EXCEPTION 'Sharing external links is not allowed in escrow chat';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS escrow_message_contact_filter ON public.escrow_messages;
CREATE TRIGGER escrow_message_contact_filter
  BEFORE INSERT ON public.escrow_messages
  FOR EACH ROW EXECUTE FUNCTION public.filter_escrow_message_contacts();

-- 6) Update send_escrow_message to also block when deal is expired/closed
CREATE OR REPLACE FUNCTION public.send_escrow_message(_sender_id uuid, _deal_id uuid, _message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_role text; v_recipient uuid;
BEGIN
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF length(_message) > 1000 THEN RAISE EXCEPTION 'Message too long (max 1000)'; END IF;
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status IN ('completed','refunded','cancelled') THEN
    RAISE EXCEPTION 'This deal is closed — no further messages';
  END IF;

  IF _sender_id = r.buyer_id THEN
    v_role := 'buyer'; v_recipient := r.seller_id;
  ELSIF _sender_id = r.seller_id THEN
    v_role := 'seller'; v_recipient := r.buyer_id;
  ELSIF is_admin(_sender_id) THEN
    v_role := 'admin'; v_recipient := NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (_deal_id, _sender_id, v_role, trim(_message));

  IF v_recipient IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_recipient, 'New escrow message 💬',
      'You have a new message in escrow deal: ' || left(r.description, 40),
      'wallet');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
