-- Function to claim any orphaned bot orders/transactions to the currently logged-in user
-- Useful when a user logs in from "View on Website" with their email and the bot orders
-- live on a different (synthetic telegram_<id>@bot.local) profile.
CREATE OR REPLACE FUNCTION public.claim_telegram_orders(_telegram_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_synth_email text;
  v_source_ids uuid[];
  v_orders int := 0;
  v_tx int := 0;
  v_notifications int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _telegram_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing telegram id');
  END IF;

  v_synth_email := 'telegram_' || _telegram_id::text || '@bot.local';

  -- Collect all profiles that belong to this telegram id but are NOT the caller
  SELECT array_agg(id) INTO v_source_ids
  FROM public.profiles
  WHERE id <> v_caller
    AND (telegram_id = _telegram_id OR lower(email) = lower(v_synth_email));

  IF v_source_ids IS NULL OR array_length(v_source_ids, 1) IS NULL THEN
    -- Still link telegram_id to the caller for future
    UPDATE public.profiles
    SET telegram_id = _telegram_id
    WHERE id = v_caller AND (telegram_id IS NULL OR telegram_id <> _telegram_id);
    RETURN jsonb_build_object('success', true, 'moved_orders', 0);
  END IF;

  -- Move orders, transactions, notifications to the caller
  UPDATE public.orders SET user_id = v_caller WHERE user_id = ANY(v_source_ids);
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  UPDATE public.transactions SET user_id = v_caller WHERE user_id = ANY(v_source_ids);
  GET DIAGNOSTICS v_tx = ROW_COUNT;

  UPDATE public.notifications SET user_id = v_caller WHERE user_id = ANY(v_source_ids);
  GET DIAGNOSTICS v_notifications = ROW_COUNT;

  -- Link telegram_id to caller
  UPDATE public.profiles
  SET telegram_id = _telegram_id
  WHERE id = v_caller AND (telegram_id IS NULL OR telegram_id <> _telegram_id);

  RETURN jsonb_build_object(
    'success', true,
    'moved_orders', v_orders,
    'moved_transactions', v_tx,
    'moved_notifications', v_notifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_telegram_orders(bigint) TO authenticated;