
-- 1. ATOMIC WALLET TRANSFER
CREATE OR REPLACE FUNCTION public.transfer_funds(
  _sender_id uuid, _receiver_id uuid, _amount numeric, _note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sender_balance numeric; sender_name text; receiver_name text; receiver_balance numeric;
BEGIN
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Invalid transfer amount'; END IF;
  IF _sender_id = _receiver_id THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;
  SELECT wallet_balance, name INTO sender_balance, sender_name FROM profiles WHERE id = _sender_id FOR UPDATE;
  IF sender_balance IS NULL THEN RAISE EXCEPTION 'Sender not found'; END IF;
  IF sender_balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  SELECT wallet_balance, name INTO receiver_balance, receiver_name FROM profiles WHERE id = _receiver_id FOR UPDATE;
  IF receiver_balance IS NULL THEN RAISE EXCEPTION 'Receiver not found'; END IF;
  UPDATE profiles SET wallet_balance = wallet_balance - _amount WHERE id = _sender_id;
  UPDATE profiles SET wallet_balance = wallet_balance + _amount WHERE id = _receiver_id;
  INSERT INTO transactions (user_id, type, amount, status, description) VALUES
    (_sender_id, 'transfer_out', -_amount, 'completed', 'Transfer to ' || receiver_name),
    (_receiver_id, 'transfer_in', _amount, 'completed', 'Transfer from ' || sender_name);
  INSERT INTO notifications (user_id, title, message, type) VALUES
    (_receiver_id, 'Money Received! 💰', 'You received ₹' || _amount::text || ' from ' || sender_name, 'wallet');
  RETURN jsonb_build_object('success', true, 'new_balance', sender_balance - _amount);
END;
$$;

-- 2. ATOMIC REDEEM GIFT CODE
CREATE OR REPLACE FUNCTION public.redeem_gift_code(_user_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  code_rec RECORD; new_balance numeric;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RAISE EXCEPTION 'Invalid code'; END IF;
  SELECT * INTO code_rec FROM redeem_codes WHERE code = upper(trim(_code)) AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or inactive code'; END IF;
  IF code_rec.expires_at IS NOT NULL AND code_rec.expires_at < now() THEN RAISE EXCEPTION 'Code has expired'; END IF;
  IF code_rec.usage_limit IS NOT NULL AND COALESCE(code_rec.used_count, 0) >= code_rec.usage_limit THEN RAISE EXCEPTION 'Code usage limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM redeem_code_usage WHERE code_id = code_rec.id AND user_id = _user_id) THEN RAISE EXCEPTION 'You have already used this code'; END IF;
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + code_rec.amount WHERE id = _user_id RETURNING wallet_balance INTO new_balance;
  INSERT INTO redeem_code_usage (code_id, user_id) VALUES (code_rec.id, _user_id);
  UPDATE redeem_codes SET used_count = COALESCE(used_count, 0) + 1 WHERE id = code_rec.id;
  INSERT INTO transactions (user_id, type, amount, status, description) VALUES (_user_id, 'gift', code_rec.amount, 'completed', 'Redeemed code: ' || code_rec.code);
  RETURN jsonb_build_object('success', true, 'amount', code_rec.amount, 'new_balance', new_balance, 'description', COALESCE(code_rec.description, 'Gift code redeemed'));
END;
$$;

-- 3. ATOMIC ORDER CANCELLATION
CREATE OR REPLACE FUNCTION public.cancel_order_refund(_user_id uuid, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_rec RECORD; new_balance numeric; has_disc boolean;
BEGIN
  SELECT * INTO order_rec FROM orders WHERE id = _order_id AND user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_rec.status <> 'pending' THEN RAISE EXCEPTION 'Order cannot be cancelled'; END IF;
  has_disc := COALESCE(order_rec.discount_applied, 0) > 0;
  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = _order_id;
  IF NOT has_disc THEN
    UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + order_rec.total_price WHERE id = _user_id RETURNING wallet_balance INTO new_balance;
    INSERT INTO transactions (user_id, type, amount, status, description) VALUES (_user_id, 'refund', order_rec.total_price, 'completed', 'Order cancelled - ' || order_rec.product_name);
  END IF;
  IF order_rec.seller_id IS NOT NULL THEN
    UPDATE profiles SET pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - (order_rec.total_price * 0.90)) WHERE id = order_rec.seller_id;
    DELETE FROM transactions WHERE user_id = order_rec.seller_id AND type = 'sale_pending' AND status = 'pending';
    INSERT INTO notifications (user_id, title, message, type) VALUES (order_rec.seller_id, 'Order Cancelled', 'Order for ' || order_rec.product_name || ' was cancelled.', 'order');
  END IF;
  RETURN jsonb_build_object('success', true, 'refunded', NOT has_disc, 'refund_amount', CASE WHEN has_disc THEN 0 ELSE order_rec.total_price END);
END;
$$;

-- 4. ATOMIC SELLER RECEIPT CONFIRMATION
CREATE OR REPLACE FUNCTION public.confirm_seller_receipt(_buyer_id uuid, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_rec RECORD; plat_comm numeric; seller_earn numeric;
BEGIN
  SELECT * INTO order_rec FROM orders WHERE id = _order_id AND user_id = _buyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_rec.seller_id IS NULL THEN RAISE EXCEPTION 'Not a seller order'; END IF;
  IF order_rec.buyer_confirmed THEN RAISE EXCEPTION 'Already confirmed'; END IF;
  plat_comm := order_rec.total_price * 0.10;
  seller_earn := order_rec.total_price - plat_comm;
  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + seller_earn, pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - seller_earn) WHERE id = order_rec.seller_id;
  UPDATE orders SET buyer_confirmed = true, is_withdrawable = true, updated_at = now() WHERE id = _order_id;
  UPDATE transactions SET status = 'completed', type = 'sale', description = 'Sale completed: ' || order_rec.product_name || ' (10% commission deducted)' WHERE user_id = order_rec.seller_id AND type = 'sale_pending' AND status = 'pending';
  INSERT INTO notifications (user_id, title, message, type) VALUES (order_rec.seller_id, 'Payment Released! 💰', 'Buyer confirmed receipt for ' || order_rec.product_name || '. ₹' || seller_earn::text || ' added to wallet.', 'payment');
  RETURN jsonb_build_object('success', true, 'seller_earnings', seller_earn);
END;
$$;
