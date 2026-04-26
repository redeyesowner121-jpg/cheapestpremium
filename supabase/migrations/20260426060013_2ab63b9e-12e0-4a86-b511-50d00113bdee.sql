-- Auto-merge telegram bot data when website user logs in.
-- Triggered from client side after auth; safe & idempotent thanks to existing merge logic.
CREATE OR REPLACE FUNCTION public.auto_merge_my_telegram_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_telegram_id bigint;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Get the logged-in user's email from auth.users
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email LIKE 'telegram_%@bot.local' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_real_email');
  END IF;

  -- Find a verified bot user with this email
  SELECT telegram_id INTO v_telegram_id
  FROM public.telegram_bot_users
  WHERE lower(email) = v_email
    AND email_verified = true
  ORDER BY last_active DESC NULLS LAST
  LIMIT 1;

  IF v_telegram_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_verified_bot_account');
  END IF;

  -- Reuse the existing battle-tested merge function
  SELECT public.merge_telegram_email_account(v_telegram_id, v_email) INTO v_result;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'reason', 'error', 'message', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auto_merge_my_telegram_data() TO authenticated;