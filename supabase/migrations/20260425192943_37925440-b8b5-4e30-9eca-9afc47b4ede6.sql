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
BEGIN
  IF v_raw = '' THEN RETURN; END IF;

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

  IF v_raw ~ '^\d{4,15}$' THEN
    BEGIN
      v_tg_id := v_raw::bigint;
    EXCEPTION WHEN OTHERS THEN
      v_tg_id := NULL;
    END;

    IF v_tg_id IS NULL THEN RETURN; END IF;

    SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
    FROM public.profiles p
    WHERE p.telegram_id = v_tg_id
       OR lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
    ORDER BY CASE WHEN p.telegram_id = v_tg_id THEN 0 ELSE 1 END, p.created_at ASC
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      RETURN QUERY SELECT v_profile_id, v_name, v_email, 'telegram_id'::text;
    END IF;
    RETURN;
  END IF;

  v_norm := lower(regexp_replace(v_raw, '^@+', ''));
  IF v_norm ~ '^[a-z0-9_]{3,32}$' THEN
    SELECT bu.telegram_id INTO v_tg_id
    FROM (
      SELECT telegram_id, username, last_active FROM public.telegram_bot_users WHERE username IS NOT NULL
      UNION ALL
      SELECT telegram_id, username, last_active FROM public.mother_bot_users WHERE username IS NOT NULL
      UNION ALL
      SELECT telegram_id, username, last_active FROM public.child_bot_users WHERE username IS NOT NULL
      UNION ALL
      SELECT telegram_id, username, last_active FROM public.netflix_bot_users WHERE username IS NOT NULL
    ) bu
    WHERE lower(bu.username) = v_norm
    ORDER BY bu.last_active DESC NULLS LAST
    LIMIT 1;

    IF v_tg_id IS NOT NULL THEN
      SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
      FROM public.profiles p
      WHERE p.telegram_id = v_tg_id
         OR lower(p.email) = lower('telegram_' || v_tg_id::text || '@bot.local')
      ORDER BY CASE WHEN p.telegram_id = v_tg_id THEN 0 ELSE 1 END, p.created_at ASC
      LIMIT 1;

      IF v_profile_id IS NOT NULL THEN
        RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
        RETURN;
      END IF;
    END IF;

    SELECT p.id, p.name, p.email INTO v_profile_id, v_name, v_email
    FROM public.profiles p
    WHERE lower(p.referral_code) = v_norm
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      RETURN QUERY SELECT v_profile_id, v_name, v_email, 'username'::text;
    END IF;
  END IF;

  RETURN;
END;
$$;