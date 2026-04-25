-- =========================================================
-- PAYMENT REQUESTS (request money by email)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their payment requests"
ON public.payment_requests FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = payer_id OR is_admin(auth.uid()));

CREATE POLICY "Service role payment_requests"
ON public.payment_requests FOR ALL
USING (false);

CREATE TRIGGER trg_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ESCROW DEALS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.escrow_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),       -- amount buyer pays (held)
  fee_amount numeric NOT NULL DEFAULT 0,             -- 2% platform fee
  seller_amount numeric NOT NULL DEFAULT 0,          -- amount - fee
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending_acceptance',
  -- pending_acceptance | funded | delivered | completed | disputed | refunded | cancelled
  delivered_note text,
  dispute_reason text,
  admin_resolution text,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  funded_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.escrow_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their escrow deals"
ON public.escrow_deals FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can update escrow deals"
ON public.escrow_deals FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Service role escrow_deals"
ON public.escrow_deals FOR ALL
USING (false);

CREATE TRIGGER trg_escrow_deals_updated_at
BEFORE UPDATE ON public.escrow_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_escrow_buyer ON public.escrow_deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON public.escrow_deals(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow_deals(status);
CREATE INDEX IF NOT EXISTS idx_payreq_payer ON public.payment_requests(payer_id);
CREATE INDEX IF NOT EXISTS idx_payreq_requester ON public.payment_requests(requester_id);

-- =========================================================
-- RPC: request money from email
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_money_from_email(
  _requester_id uuid, _payer_email text, _amount numeric, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payer_id uuid; v_payer_name text; v_requester_name text; v_id uuid;
BEGIN
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _payer_email IS NULL OR length(trim(_payer_email)) = 0 THEN RAISE EXCEPTION 'Email required'; END IF;
  SELECT id, name INTO v_payer_id, v_payer_name FROM profiles WHERE lower(email) = lower(trim(_payer_email)) LIMIT 1;
  IF v_payer_id IS NULL THEN RAISE EXCEPTION 'No user found with this email'; END IF;
  IF v_payer_id = _requester_id THEN RAISE EXCEPTION 'Cannot request money from yourself'; END IF;
  SELECT name INTO v_requester_name FROM profiles WHERE id = _requester_id;
  INSERT INTO payment_requests (requester_id, payer_id, amount, note)
  VALUES (_requester_id, v_payer_id, _amount, _note) RETURNING id INTO v_id;
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_payer_id, 'Money Request 💸',
    COALESCE(v_requester_name,'A user') || ' requested ₹' || _amount::text ||
    CASE WHEN _note IS NOT NULL AND length(_note)>0 THEN ' for: ' || _note ELSE '' END,
    'wallet');
  RETURN jsonb_build_object('success', true, 'request_id', v_id, 'payer_name', v_payer_name);
END;
$$;

-- =========================================================
-- RPC: respond to payment request
-- =========================================================
CREATE OR REPLACE FUNCTION public.respond_payment_request(
  _payer_id uuid, _request_id uuid, _accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD; v_result jsonb;
BEGIN
  SELECT * INTO r FROM payment_requests WHERE id = _request_id AND payer_id = _payer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already handled'; END IF;
  IF _accept THEN
    v_result := transfer_funds(_payer_id, r.requester_id, r.amount, COALESCE(r.note, 'Payment request'));
    UPDATE payment_requests SET status = 'accepted' WHERE id = _request_id;
  ELSE
    UPDATE payment_requests SET status = 'declined' WHERE id = _request_id;
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (r.requester_id, 'Request Declined', 'Your money request of ₹' || r.amount::text || ' was declined.', 'wallet');
  END IF;
  RETURN jsonb_build_object('success', true, 'accepted', _accept);
END;
$$;

-- =========================================================
-- RPC: create escrow deal (buyer initiates, funds held immediately)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_escrow_deal(
  _buyer_id uuid, _seller_email text, _amount numeric, _description text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seller_id uuid; v_seller_name text; v_buyer_balance numeric;
  v_fee numeric; v_seller_amt numeric; v_id uuid; v_buyer_name text;
BEGIN
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _description IS NULL OR length(trim(_description)) < 5 THEN RAISE EXCEPTION 'Please describe the deal (min 5 chars)'; END IF;
  SELECT id, name INTO v_seller_id, v_seller_name FROM profiles WHERE lower(email) = lower(trim(_seller_email)) LIMIT 1;
  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'No user found with that email'; END IF;
  IF v_seller_id = _buyer_id THEN RAISE EXCEPTION 'Cannot create deal with yourself'; END IF;
  SELECT wallet_balance, name INTO v_buyer_balance, v_buyer_name FROM profiles WHERE id = _buyer_id FOR UPDATE;
  IF v_buyer_balance < _amount THEN RAISE EXCEPTION 'Insufficient balance to fund escrow'; END IF;

  v_fee := round((_amount * 0.02)::numeric, 2);
  v_seller_amt := _amount - v_fee;

  -- Hold funds: deduct from buyer wallet now
  UPDATE profiles SET wallet_balance = wallet_balance - _amount WHERE id = _buyer_id;

  INSERT INTO escrow_deals (buyer_id, seller_id, amount, fee_amount, seller_amount, description, status, funded_at)
  VALUES (_buyer_id, v_seller_id, _amount, v_fee, v_seller_amt, _description, 'funded', now())
  RETURNING id INTO v_id;

  INSERT INTO transactions (user_id, type, amount, status, description)
  VALUES (_buyer_id, 'escrow_hold', -_amount, 'pending', 'Escrow funded: ' || _description);

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_seller_id, 'New Escrow Deal 🤝',
    COALESCE(v_buyer_name,'A buyer') || ' funded an escrow of ₹' || _amount::text || ' for: ' || _description,
    'wallet');

  RETURN jsonb_build_object('success', true, 'deal_id', v_id, 'seller_amount', v_seller_amt, 'fee', v_fee);
END;
$$;

-- =========================================================
-- RPC: seller marks delivered
-- =========================================================
CREATE OR REPLACE FUNCTION public.seller_mark_escrow_delivered(
  _seller_id uuid, _deal_id uuid, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND seller_id = _seller_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status <> 'funded' THEN RAISE EXCEPTION 'Deal not in funded state'; END IF;
  UPDATE escrow_deals SET status='delivered', delivered_note=_note, delivered_at=now() WHERE id=_deal_id;
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (r.buyer_id, 'Escrow: Seller Delivered ✅',
    'Seller marked your escrow deal as delivered. Please confirm to release payment.', 'wallet');
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================================
-- RPC: buyer confirms → release to seller (auto)
-- =========================================================
CREATE OR REPLACE FUNCTION public.buyer_confirm_escrow(_buyer_id uuid, _deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND buyer_id = _buyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status NOT IN ('delivered','funded') THEN RAISE EXCEPTION 'Cannot confirm in current status'; END IF;
  UPDATE profiles SET wallet_balance = wallet_balance + r.seller_amount WHERE id = r.seller_id;
  UPDATE escrow_deals SET status='completed', completed_at=now() WHERE id=_deal_id;
  UPDATE transactions SET status='completed', type='escrow_released'
    WHERE user_id = r.buyer_id AND type='escrow_hold' AND description LIKE 'Escrow funded:%' AND status='pending'
    AND amount = -r.amount;
  INSERT INTO transactions (user_id, type, amount, status, description)
  VALUES (r.seller_id, 'escrow_received', r.seller_amount, 'completed',
    'Escrow released (2% fee): ' || r.description);
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (r.seller_id, 'Escrow Released 💰',
    'Buyer confirmed. ₹' || r.seller_amount::text || ' added to your wallet.', 'wallet');
  RETURN jsonb_build_object('success', true, 'released', r.seller_amount);
END;
$$;

-- =========================================================
-- RPC: open dispute (either party)
-- =========================================================
CREATE OR REPLACE FUNCTION public.dispute_escrow(_user_id uuid, _deal_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF _user_id <> r.buyer_id AND _user_id <> r.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.status NOT IN ('funded','delivered') THEN RAISE EXCEPTION 'Cannot dispute in current status'; END IF;
  UPDATE escrow_deals SET status='disputed', dispute_reason=_reason WHERE id=_deal_id;
  -- Notify the other party + admins (admins notified via admin panel)
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (CASE WHEN _user_id = r.buyer_id THEN r.seller_id ELSE r.buyer_id END,
    'Escrow Disputed ⚠️', 'A dispute was opened. Admin will review.', 'wallet');
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================================
-- RPC: admin resolves dispute (release to seller or refund buyer)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_escrow(
  _admin_id uuid, _deal_id uuid, _action text, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  IF NOT is_admin(_admin_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status NOT IN ('funded','delivered','disputed') THEN RAISE EXCEPTION 'Cannot resolve in current status'; END IF;

  IF _action = 'release' THEN
    UPDATE profiles SET wallet_balance = wallet_balance + r.seller_amount WHERE id = r.seller_id;
    UPDATE escrow_deals SET status='completed', completed_at=now(), admin_resolution='release: '||COALESCE(_note,''), resolved_by=_admin_id WHERE id=_deal_id;
    UPDATE transactions SET status='completed', type='escrow_released'
      WHERE user_id = r.buyer_id AND type='escrow_hold' AND status='pending' AND amount = -r.amount;
    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (r.seller_id, 'escrow_received', r.seller_amount, 'completed', 'Escrow released by admin: ' || r.description);
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (r.seller_id, 'Escrow Released by Admin', '₹' || r.seller_amount::text || ' has been released.', 'wallet'),
           (r.buyer_id, 'Escrow Resolved', 'Admin released funds to seller.', 'wallet');
    RETURN jsonb_build_object('success', true, 'action', 'released');
  ELSIF _action = 'refund' THEN
    UPDATE profiles SET wallet_balance = wallet_balance + r.amount WHERE id = r.buyer_id;
    UPDATE escrow_deals SET status='refunded', completed_at=now(), admin_resolution='refund: '||COALESCE(_note,''), resolved_by=_admin_id WHERE id=_deal_id;
    UPDATE transactions SET status='completed', type='escrow_refunded', description='Escrow refunded: ' || r.description
      WHERE user_id = r.buyer_id AND type='escrow_hold' AND status='pending' AND amount = -r.amount;
    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (r.buyer_id, 'refund', r.amount, 'completed', 'Escrow refund: ' || r.description);
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (r.buyer_id, 'Escrow Refunded', '₹' || r.amount::text || ' returned to your wallet.', 'wallet'),
           (r.seller_id, 'Escrow Refunded', 'Admin refunded the buyer.', 'wallet');
    RETURN jsonb_build_object('success', true, 'action', 'refunded');
  ELSE
    RAISE EXCEPTION 'Invalid action (use release or refund)';
  END IF;
END;
$$;