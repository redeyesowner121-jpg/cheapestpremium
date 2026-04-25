CREATE OR REPLACE FUNCTION public.merge_telegram_email_account(_telegram_id bigint, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_target profiles%ROWTYPE;
  v_source profiles%ROWTYPE;
  v_wallet RECORD;
  v_bot_user RECORD;
  v_target_is_real boolean := false;
  v_source_is_distinct boolean := false;
  v_already_merged boolean := false;
  v_source_wallet numeric := 0;
  v_source_deposit numeric := 0;
  v_source_rank numeric := 0;
  v_source_pending numeric := 0;
  v_source_savings numeric := 0;
  v_orders integer := 0;
  v_transactions integer := 0;
  v_notifications integer := 0;
  v_resale_links integer := 0;
  v_escrows integer := 0;
  v_is_bot_admin boolean := false;
  v_is_bot_reseller boolean := false;
BEGIN
  v_email := lower(trim(coalesce(_email, '')));
  IF _telegram_id IS NULL OR v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Valid telegram id and email are required';
  END IF;

  SELECT * INTO v_bot_user
  FROM public.telegram_bot_users
  WHERE telegram_id = _telegram_id
  FOR UPDATE;

  IF FOUND AND (coalesce(v_bot_user.email_verified, false) IS FALSE OR lower(coalesce(v_bot_user.email, '')) <> v_email) THEN
    RAISE EXCEPTION 'Telegram email is not verified';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE lower(email) = v_email
  ORDER BY CASE WHEN email NOT LIKE 'telegram_%@bot.local' THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1
  FOR UPDATE;

  SELECT * INTO v_source
  FROM public.profiles
  WHERE telegram_id = _telegram_id OR lower(email) = lower('telegram_' || _telegram_id::text || '@bot.local')
  ORDER BY CASE WHEN lower(email) = lower('telegram_' || _telegram_id::text || '@bot.local') THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_target.id IS NULL AND v_source.id IS NULL THEN
    RAISE EXCEPTION 'No account found to merge';
  END IF;

  IF v_target.id IS NULL THEN
    v_target := v_source;
  END IF;

  IF v_target.telegram_id IS NOT NULL AND v_target.telegram_id <> _telegram_id THEN
    RAISE EXCEPTION 'This website account is already linked to another Telegram account';
  END IF;

  v_target_is_real := v_target.email NOT LIKE 'telegram_%@bot.local';
  v_source_is_distinct := v_source.id IS NOT NULL AND v_source.id <> v_target.id;

  SELECT * INTO v_wallet
  FROM public.telegram_wallets
  WHERE telegram_id = _telegram_id
  FOR UPDATE;

  SELECT EXISTS (SELECT 1 FROM public.telegram_bot_admins WHERE telegram_id = _telegram_id)
    OR coalesce(v_bot_user.role, '') IN ('owner', 'admin')
  INTO v_is_bot_admin;

  SELECT coalesce(v_wallet.is_reseller, false)
    OR coalesce(v_bot_user.role, '') = 'reseller'
    OR EXISTS (SELECT 1 FROM public.telegram_resale_links WHERE reseller_telegram_id = _telegram_id AND is_active = true)
  INTO v_is_bot_reseller;

  IF v_source_is_distinct THEN
    SELECT EXISTS (
      SELECT 1 FROM public.account_merge_audit
      WHERE telegram_id = _telegram_id
        AND target_profile_id = v_target.id
        AND source_profile_id = v_source.id
    ) INTO v_already_merged;

    IF NOT v_already_merged THEN
      v_source_wallet := greatest(coalesce(v_wallet.balance, 0), coalesce(v_source.wallet_balance, 0));
      v_source_deposit := greatest(coalesce(v_wallet.total_earned, 0), coalesce(v_source.total_deposit, 0));
      v_source_rank := coalesce(v_source.rank_balance, 0);
      v_source_pending := coalesce(v_source.pending_balance, 0);
      v_source_savings := coalesce(v_source.total_savings, 0);
    END IF;

    UPDATE public.profiles
    SET telegram_id = NULL,
        updated_at = now()
    WHERE id = v_source.id;

    UPDATE public.orders SET user_id = v_target.id WHERE user_id = v_source.id;
    GET DIAGNOSTICS v_orders = ROW_COUNT;

    UPDATE public.orders SET seller_id = v_target.id WHERE seller_id = v_source.id;
    GET DIAGNOSTICS v_escrows = ROW_COUNT;

    UPDATE public.transactions SET user_id = v_target.id WHERE user_id = v_source.id;
    GET DIAGNOSTICS v_transactions = ROW_COUNT;

    UPDATE public.notifications SET user_id = v_target.id WHERE user_id = v_source.id;
    GET DIAGNOSTICS v_notifications = ROW_COUNT;

    UPDATE public.resale_links SET reseller_id = v_target.id WHERE reseller_id = v_source.id;
    GET DIAGNOSTICS v_resale_links = ROW_COUNT;

    UPDATE public.payment_requests SET requester_id = v_target.id WHERE requester_id = v_source.id;
    UPDATE public.payment_requests SET payer_id = v_target.id WHERE payer_id = v_source.id;
    UPDATE public.escrow_deals SET buyer_id = v_target.id WHERE buyer_id = v_source.id;
    UPDATE public.escrow_deals SET seller_id = v_target.id WHERE seller_id = v_source.id;
    UPDATE public.escrow_messages SET sender_id = v_target.id WHERE sender_id = v_source.id;

    INSERT INTO public.user_roles (user_id, role, temp_admin_expiry)
    SELECT v_target.id, role, temp_admin_expiry
    FROM public.user_roles
    WHERE user_id = v_source.id
    ON CONFLICT (user_id, role) DO UPDATE
      SET temp_admin_expiry = greatest(public.user_roles.temp_admin_expiry, excluded.temp_admin_expiry);
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.account_merge_audit
      WHERE telegram_id = _telegram_id
        AND target_profile_id = v_target.id
        AND source_profile_id IS NULL
    ) INTO v_already_merged;

    IF NOT v_already_merged THEN
      v_source_wallet := coalesce(v_wallet.balance, 0);
      v_source_deposit := coalesce(v_wallet.total_earned, 0);
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    telegram_id = _telegram_id,
    email = CASE WHEN v_target_is_real THEN profiles.email ELSE v_email END,
    wallet_balance = coalesce(profiles.wallet_balance, 0) + v_source_wallet,
    total_deposit = coalesce(profiles.total_deposit, 0) + v_source_deposit,
    rank_balance = greatest(coalesce(profiles.rank_balance, 0), coalesce(profiles.rank_balance, 0) + v_source_rank, coalesce(profiles.total_deposit, 0) + v_source_deposit),
    pending_balance = coalesce(profiles.pending_balance, 0) + v_source_pending,
    total_savings = coalesce(profiles.total_savings, 0) + v_source_savings,
    total_orders = coalesce(profiles.total_orders, 0) + CASE WHEN v_source_is_distinct THEN coalesce(v_source.total_orders, 0) ELSE 0 END,
    is_reseller = coalesce(profiles.is_reseller, false) OR v_is_bot_reseller OR CASE WHEN v_source_is_distinct THEN coalesce(v_source.is_reseller, false) ELSE false END,
    has_blue_check = coalesce(profiles.has_blue_check, false) OR CASE WHEN v_source_is_distinct THEN coalesce(v_source.has_blue_check, false) ELSE false END,
    avatar_url = coalesce(profiles.avatar_url, CASE WHEN v_source_is_distinct THEN v_source.avatar_url ELSE NULL END),
    updated_at = now()
  WHERE id = v_target.id
  RETURNING * INTO v_target;

  IF v_is_bot_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_target.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF v_wallet.telegram_id IS NOT NULL THEN
    UPDATE public.telegram_wallets
    SET balance = coalesce(v_target.wallet_balance, 0),
        total_earned = greatest(coalesce(total_earned, 0), coalesce(v_target.total_deposit, 0)),
        is_reseller = coalesce(is_reseller, false) OR coalesce(v_target.is_reseller, false),
        updated_at = now()
    WHERE telegram_id = _telegram_id;
  END IF;

  UPDATE public.telegram_bot_users
  SET email = v_email,
      email_verified = true,
      pending_email = NULL,
      email_otp_code = NULL,
      email_otp_expires_at = NULL,
      email_otp_attempts = 0
  WHERE telegram_id = _telegram_id;

  INSERT INTO public.account_merge_audit (
    telegram_id, source_profile_id, target_profile_id, email,
    merged_wallet_amount, merged_total_deposit, merged_rank_balance,
    merged_pending_balance, merged_total_savings, moved_orders,
    moved_transactions, moved_notifications, moved_resale_links, moved_escrows
  ) VALUES (
    _telegram_id, CASE WHEN v_source_is_distinct THEN v_source.id ELSE NULL END, v_target.id, v_email,
    v_source_wallet, v_source_deposit, v_source_rank, v_source_pending, v_source_savings,
    v_orders, v_transactions, v_notifications, v_resale_links, v_escrows
  )
  ON CONFLICT (telegram_id, target_profile_id) DO NOTHING;

  IF v_source_is_distinct THEN
    UPDATE public.profiles
    SET wallet_balance = 0,
        total_deposit = 0,
        rank_balance = 0,
        pending_balance = 0,
        total_savings = 0,
        is_reseller = false,
        updated_at = now()
    WHERE id = v_source.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'target_profile_id', v_target.id,
    'source_profile_id', CASE WHEN v_source_is_distinct THEN v_source.id ELSE NULL END,
    'telegram_id', _telegram_id,
    'email', v_email,
    'already_merged', v_already_merged,
    'merged_wallet_amount', v_source_wallet,
    'is_reseller', coalesce(v_target.is_reseller, false),
    'is_admin', v_is_bot_admin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_telegram_email_account(bigint, text) TO service_role;