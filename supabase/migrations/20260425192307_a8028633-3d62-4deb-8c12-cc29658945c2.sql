CREATE OR REPLACE FUNCTION public.find_profile_by_identifier(_identifier text)
 RETURNS TABLE(profile_id uuid, name text, email text, identifier_kind text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_raw text := trim(coalesce(_identifier, ''));
  v_norm text;
  v_tg_id bigint;
  v_profile_id uuid;
  v_email text;
  v_name text;
  v_first_name text;
  v_username text;
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

    -- 2c) Auto-provision a synthetic profile from ANY bot user table
    IF v_profile_id IS NULL THEN
      -- Search across all bot user tables
      SELECT first_name, username INTO v_first_name, v_username
      FROM public.telegram_bot_users WHERE telegram_id = v_tg_id LIMIT 1;
      IF v_first_name IS NULL AND v_username IS NULL THEN
        SELECT first_name, username INTO v_first_name, v_username
        FROM public.mother_bot_users WHERE telegram_id = v_tg_id LIMIT 1;
      END IF;
      IF v_first_name IS NULL AND v_username IS NULL THEN
        SELECT first_name, username INTO v_first_name, v_username
        FROM public.child_bot_users WHERE telegram_id = v_tg_id LIMIT 1;
      END IF;
      IF v_first_name IS NULL AND v_username IS NULL THEN
        SELECT first_name, username INTO v_first_name, v_username
        FROM public.netflix_bot_users WHERE telegram_id = v_tg_id LIMIT 1;
      END IF;

      IF v_first_name IS NOT NULL OR v_username IS NOT NULL THEN
        v_email := 'telegram_' || v_tg_id::text || '@bot.local';
        v_name  := coalesce(v_first_name, v_username, 'TG ' || v_tg_id::text);
        INSERT INTO public.profiles (email, name, telegram_id, wallet_balance)
        VALUES (v_email, v_name, v_tg_id, 0)
        ON CONFLICT (email) DO UPDATE SET telegram_id = excluded.telegram_id
        RETURNING id INTO v_profile_id;
      ELSE
        -- Even unknown TG IDs: create a stub profile so escrow can be addressed.
        v_email := 'telegram_' || v_tg_id::text || '@bot.local';
        v_name  := 'TG ' || v_tg_id::text;
        INSERT INTO public.profiles (email, name, telegram_id, wallet_balance)
        VALUES (v_email, v_name, v_tg_id, 0)
        ON CONFLICT (email) DO UPDATE SET telegram_id = excluded.telegram_id
        RETURNING id INTO v_profile_id;
      END IF;
    END IF;

    IF v_profile_id IS NOT NULL THEN
      RETURN QUERY SELECT v_profile_id, v_name, v_email, 'telegram_id'::text;
    END IF;
    RETURN;
  END IF;

  -- 3) Username (with or without leading @) — search ALL bot tables
  v_norm := lower(regexp_replace(v_raw, '^@+', ''));
  IF v_norm ~ '^[a-z0-9_]{3,32}$' THEN
    -- Try all bot user tables in priority order
    SELECT telegram_id, first_name, username INTO v_tg_id, v_first_name, v_username
    FROM public.telegram_bot_users
    WHERE lower(username) = v_norm
    ORDER BY last_active DESC NULLS LAST LIMIT 1;

    IF v_tg_id IS NULL THEN
      SELECT telegram_id, first_name, username INTO v_tg_id, v_first_name, v_username
      FROM public.mother_bot_users
      WHERE lower(username) = v_norm
      ORDER BY last_active DESC NULLS LAST LIMIT 1;
    END IF;

    IF v_tg_id IS NULL THEN
      SELECT telegram_id, first_name, username INTO v_tg_id, v_first_name, v_username
      FROM public.child_bot_users
      WHERE lower(username) = v_norm
      ORDER BY last_active DESC NULLS LAST LIMIT 1;
    END IF;

    IF v_tg_id IS NULL THEN
      SELECT telegram_id, first_name, username INTO v_tg_id, v_first_name, v_username
      FROM public.netflix_bot_users
      WHERE lower(username) = v_norm
      ORDER BY last_active DESC NULLS LAST LIMIT 1;
    END IF;

    -- Also try website profiles by referral_code (since profiles may have a public username analog)
    IF v_tg_id IS NULL THEN
      SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
      FROM public.profiles p
      WHERE lower(p.referral_code) = upper(v_norm) OR lower(p.referral_code) = v_norm
      LIMIT 1;
      IF v_profile_id IS NOT NULL THEN
        RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
      END IF;
      RETURN;
    END IF;

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
      v_name  := coalesce(v_first_name, v_username, 'TG ' || v_tg_id::text);
      INSERT INTO public.profiles (email, name, telegram_id, wallet_balance)
      VALUES (v_email, v_name, v_tg_id, 0)
      ON CONFLICT (email) DO UPDATE SET telegram_id = excluded.telegram_id
      RETURNING id INTO v_profile_id;
    END IF;

    RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
  END IF;
  RETURN;
END;
$function$;