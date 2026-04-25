-- Case-insensitive index for telegram_bot_users.username lookup
CREATE INDEX IF NOT EXISTS idx_telegram_bot_users_username_lower
  ON public.telegram_bot_users (lower(username))
  WHERE username IS NOT NULL;

-- Resolve an arbitrary identifier (email, @username, or numeric TG id) to a profile id.
CREATE OR REPLACE FUNCTION public.find_profile_by_identifier(_identifier text)
RETURNS TABLE(profile_id uuid, name text, email text, identifier_kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw text := trim(coalesce(_identifier, ''));
  v_norm text;
  v_tg_id bigint;
  v_username text;
  v_profile_id uuid;
  v_email text;
  v_name text;
BEGIN
  IF v_raw = '' THEN RETURN; END IF;

  -- 1) Email
  IF v_raw ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
    FROM public.profiles p
    WHERE lower(p.email) = lower(v_raw)
    LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      RETURN QUERY SELECT v_profile_id, v_name, v_email, 'email'::text;
    END IF;
    RETURN;
  END IF;

  -- 2) Numeric Telegram ID
  IF v_raw ~ '^\d{4,15}$' THEN
    BEGIN v_tg_id := v_raw::bigint; EXCEPTION WHEN OTHERS THEN v_tg_id := NULL; END;
    IF v_tg_id IS NOT NULL THEN
      -- existing linked profile
      SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
      FROM public.profiles p
      WHERE p.telegram_id = v_tg_id
      LIMIT 1;
      IF v_profile_id IS NULL THEN
        -- synthetic bot profile by email
        SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
        FROM public.profiles p
        WHERE lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
        LIMIT 1;
      END IF;
      IF v_profile_id IS NOT NULL THEN
        RETURN QUERY SELECT v_profile_id, v_name, v_email, 'telegram_id'::text;
      END IF;
    END IF;
    RETURN;
  END IF;

  -- 3) Username (with or without leading @)
  v_norm := lower(regexp_replace(v_raw, '^@+', ''));
  IF v_norm ~ '^[a-z0-9_]{3,32}$' THEN
    -- direct match in profiles via telegram link to bot user
    SELECT bu.telegram_id INTO v_tg_id
    FROM public.telegram_bot_users bu
    WHERE lower(bu.username) = v_norm
    ORDER BY bu.last_active DESC NULLS LAST
    LIMIT 1;

    IF v_tg_id IS NOT NULL THEN
      SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
      FROM public.profiles p
      WHERE p.telegram_id = v_tg_id
         OR lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
      ORDER BY CASE WHEN p.telegram_id = v_tg_id THEN 0 ELSE 1 END
      LIMIT 1;
      IF v_profile_id IS NOT NULL THEN
        RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
      END IF;
    END IF;
  END IF;
  RETURN;
END;
$$;

-- Generic escrow creator: accepts any identifier
CREATE OR REPLACE FUNCTION public.create_escrow_deal_by_identifier(
  _buyer_id uuid, _identifier text, _amount numeric, _description text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_seller_id uuid;
  v_seller_name text;
  v_buyer_balance numeric;
  v_buyer_name text;
  v_fee numeric;
  v_seller_amt numeric;
  v_id uuid;
BEGIN
  IF _amount <= 0 OR _amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _description IS NULL OR length(trim(_description)) < 5 THEN
    RAISE EXCEPTION 'Please describe the deal (min 5 chars)';
  END IF;

  SELECT * INTO r FROM public.find_profile_by_identifier(_identifier) LIMIT 1;
  IF r.profile_id IS NULL THEN
    RAISE EXCEPTION 'No user found with that email / username / Telegram ID';
  END IF;
  v_seller_id := r.profile_id;
  v_seller_name := r.name;

  IF v_seller_id = _buyer_id THEN RAISE EXCEPTION 'Cannot create deal with yourself'; END IF;

  SELECT wallet_balance, name INTO v_buyer_balance, v_buyer_name
  FROM public.profiles WHERE id = _buyer_id;
  IF v_buyer_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance to fund this escrow';
  END IF;

  v_fee := round((_amount * 0.02)::numeric, 2);
  v_seller_amt := _amount - v_fee;

  INSERT INTO public.escrow_deals
    (buyer_id, seller_id, amount, fee_amount, seller_amount, description, status, expires_at)
  VALUES
    (_buyer_id, v_seller_id, _amount, v_fee, v_seller_amt, _description, 'pending_acceptance', now() + interval '30 minutes')
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_seller_id, 'New Escrow Request 🤝',
    coalesce(v_buyer_name,'A buyer') || ' wants to start an escrow of ₹' || _amount::text ||
    '. Accept within 30 minutes.', 'wallet');

  INSERT INTO public.escrow_messages (deal_id, sender_id, sender_role, message)
  VALUES (v_id, _buyer_id, 'system', 'Escrow created. Auto-expires in 30 minutes if not accepted.');

  RETURN jsonb_build_object(
    'success', true,
    'deal_id', v_id,
    'seller_amount', v_seller_amt,
    'fee', v_fee,
    'seller_id', v_seller_id,
    'seller_name', coalesce(v_seller_name, ''),
    'identifier_kind', r.identifier_kind,
    'status', 'pending_acceptance'
  );
END;
$$;