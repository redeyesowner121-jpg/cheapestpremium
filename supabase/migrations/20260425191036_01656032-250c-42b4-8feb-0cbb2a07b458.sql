CREATE OR REPLACE FUNCTION public.buyer_confirm_escrow(_buyer_id uuid, _deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM escrow_deals WHERE id = _deal_id AND buyer_id = _buyer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF r.status <> 'delivered' THEN
    RAISE EXCEPTION 'You can release funds only after the seller marks the deal as delivered';
  END IF;
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
$function$;