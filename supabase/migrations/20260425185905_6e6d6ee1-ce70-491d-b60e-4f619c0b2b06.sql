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
  v_profile_id uuid;
  v_email text;
  v_name text;
  v_bu RECORD;
BEGIN
  IF v_raw = '' THEN RETURN; END IF;

  -- 1) Email — only matches existing website / merged accounts
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
    IF v_tg_id IS NULL THEN RETURN; END IF;

    -- 2a) profile linked by telegram_id
    SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
    FROM public.profiles p
    WHERE p.telegram_id = v_tg_id
    LIMIT 1;

    -- 2b) synthetic bot profile by email pattern
    IF v_profile_id IS NULL THEN
      SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
      FROM public.profiles p
      WHERE lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
      LIMIT 1;
    END IF;

    -- 2c) Auto-provision a synthetic profile for the bot user
    IF v_profile_id IS NULL THEN
      SELECT * INTO v_bu FROM public.telegram_bot_users WHERE telegram_id = v_tg_id LIMIT 1;
      IF v_bu.telegram_id IS NOT NULL THEN
        v_email := 'telegram_' || v_tg_id::text || '@bot.local';
        v_name  := coalesce(v_bu.first_name, v_bu.username, 'TG ' || v_tg_id::text);
        INSERT INTO public.profiles (email, name, telegram_id, wallet_balance)
        VALUES (v_email, v_name, v_tg_id, 0)
        RETURNING id INTO v_profile_id;
      END IF;
    END IF;

    IF v_profile_id IS NOT NULL THEN
      RETURN QUERY SELECT v_profile_id, v_name, v_email, 'telegram_id'::text;
    END IF;
    RETURN;
  END IF;

  -- 3) Username (with or without leading @) — Telegram-only lookup
  v_norm := lower(regexp_replace(v_raw, '^@+', ''));
  IF v_norm ~ '^[a-z0-9_]{3,32}$' THEN
    SELECT * INTO v_bu
    FROM public.telegram_bot_users
    WHERE lower(username) = v_norm
    ORDER BY last_active DESC NULLS LAST
    LIMIT 1;

    IF v_bu.telegram_id IS NULL THEN
      RETURN; -- do NOT fall back to website-only profiles by name/email
    END IF;

    v_tg_id := v_bu.telegram_id;

    -- linked / merged profile
    SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
    FROM public.profiles p
    WHERE p.telegram_id = v_tg_id
       OR lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
    ORDER BY CASE WHEN p.telegram_id = v_tg_id THEN 0 ELSE 1 END
    LIMIT 1;

    -- Auto-provision synthetic profile if none exists
    IF v_profile_id IS NULL THEN
      v_email := 'telegram_' || v_tg_id::text || '@bot.local';
      v_name  := coalesce(v_bu.first_name, v_bu.username, 'TG ' || v_tg_id::text);
      INSERT INTO public.profiles (email, name, telegram_id, wallet_balance)
      VALUES (v_email, v_name, v_tg_id, 0)
      RETURNING id INTO v_profile_id;
    END IF;

    RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
  END IF;
  RETURN;
END;
$$;