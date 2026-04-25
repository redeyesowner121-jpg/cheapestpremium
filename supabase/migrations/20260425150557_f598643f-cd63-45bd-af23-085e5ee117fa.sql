
-- =========================================================
-- ESCROW v2: Acceptance flow + chat + cancellations
-- =========================================================

-- 1) Escrow chat messages
CREATE TABLE IF NOT EXISTS public.escrow_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('buyer','seller','admin','system')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_msg_deal ON public.escrow_messages(deal_id, created_at);

ALTER TABLE public.escrow_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view escrow messages" ON public.escrow_messages;
CREATE POLICY "Participants view escrow messages"
ON public.escrow_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM escrow_deals d
    WHERE d.id = escrow_messages.deal_id
      AND (auth.uid() = d.buyer_id OR auth.uid() = d.seller_id OR is_admin(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Participants send escrow messages" ON public.escrow_messages;
CREATE POLICY "Participants send escrow messages"
ON public.escrow_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM escrow_deals d
    WHERE d.id = escrow_messages.deal_id
      AND (auth.uid() = d.buyer_id OR auth.uid() = d.seller_id OR is_admin(auth.uid()))
  )
);

-- Realtime
ALTER TABLE public.escrow_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='escrow_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_messages';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='escrow_deals';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.escrow_deals';
  END IF;
END $$;

-- 2) Rewrite create_escrow_deal: pending_acceptance status, no fund hold yet
CREATE OR REPLACE FUNCTION public.create_escrow_deal(
  _buyer_id uuid, _seller_email text, _amount numeric, _description text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  INSERT INTO escrow_deals (buyer_id, seller_id, amount, fee_amount, seller_amount, description, status)
  VALUES (_buyer_id, v_seller_id, _amount, v_fee, v_seller_amt, _description, 'pending_acceptance')
  RETURNING id INTO v_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_seller_id, 'New Escrow Request 🤝',
    COALESCE(v_buyer_name,'A buyer') || ' wants to start an escrow of ₹' || _amount::text || ' for: ' || _description || '. Accept or decline.',
    'wallet');

  INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (v_id, _buyer_id, 'system', 'Escrow created. Waiting for seller to accept.');

  RETURN jsonb_build_object('success', true, 'deal_id', v_id, 'seller_amount', v_seller_amt, 'fee', v_fee, 'status', 'pending_acceptance');
END;
$$;

-- 3) Seller accepts/rejects → hold funds on accept
CREATE OR REPLACE FUNCTION public.seller_respond_escrow(
  _seller_id uuid, _deal_id uuid, _accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD; v_buyer_balance numeric;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND seller_id = _seller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status <> 'pending_acceptance' THEN RAISE EXCEPTION 'Deal already processed'; END IF;

  IF _accept THEN
    SELECT wallet_balance INTO v_buyer_balance FROM profiles WHERE id = r.buyer_id FOR UPDATE;
    IF v_buyer_balance < r.amount THEN
      UPDATE escrow_deals SET status='cancelled', admin_resolution='auto_cancel:buyer_insufficient' WHERE id=_deal_id;
      INSERT INTO notifications (user_id, title, message, type) VALUES
        (r.buyer_id, 'Escrow Cancelled', 'Your escrow was cancelled — insufficient balance when seller accepted.', 'wallet'),
        (r.seller_id, 'Escrow Cancelled', 'Buyer no longer has enough balance.', 'wallet');
      RETURN jsonb_build_object('success', false, 'reason', 'buyer_insufficient_balance');
    END IF;

    UPDATE profiles SET wallet_balance = wallet_balance - r.amount WHERE id = r.buyer_id;
    UPDATE escrow_deals SET status='funded', funded_at=now() WHERE id=_deal_id;

    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (r.buyer_id, 'escrow_hold', -r.amount, 'pending', 'Escrow funded: ' || r.description);

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (r.buyer_id, 'Escrow Accepted ✅',
      'Seller accepted. ₹' || r.amount::text || ' is now held in escrow.', 'wallet');

    INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
    VALUES (_deal_id, _seller_id, 'system', 'Seller accepted. Funds are now held. Seller — please deliver and mark as delivered.');

    RETURN jsonb_build_object('success', true, 'status', 'funded');
  ELSE
    UPDATE escrow_deals SET status='cancelled', admin_resolution='seller_declined' WHERE id=_deal_id;
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (r.buyer_id, 'Escrow Declined ❌', 'Seller declined your escrow request.', 'wallet');
    INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
    VALUES (_deal_id, _seller_id, 'system', 'Seller declined this escrow.');
    RETURN jsonb_build_object('success', true, 'status', 'cancelled');
  END IF;
END;
$$;

-- 4) Buyer cancels (only before seller acceptance)
CREATE OR REPLACE FUNCTION public.cancel_escrow_deal(_buyer_id uuid, _deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND buyer_id = _buyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status <> 'pending_acceptance' THEN RAISE EXCEPTION 'Cannot cancel after seller accepted. Open a dispute instead.'; END IF;

  UPDATE escrow_deals SET status='cancelled', admin_resolution='buyer_cancelled' WHERE id=_deal_id;
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (r.seller_id, 'Escrow Cancelled', 'Buyer cancelled the pending escrow request.', 'wallet');
  INSERT INTO escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (_deal_id, _buyer_id, 'system', 'Buyer cancelled this escrow.');
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5) Send chat message
CREATE OR REPLACE FUNCTION public.send_escrow_message(
  _sender_id uuid, _deal_id uuid, _message text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD; v_role text; v_recipient uuid;
BEGIN
  IF _message IS NULL OR length(trim(_message)) = 0 THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF length(_message) > 1000 THEN RAISE EXCEPTION 'Message too long (max 1000)'; END IF;
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;

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
$$;
