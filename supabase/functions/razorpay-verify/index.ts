import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use server-derived userId, NOT client-supplied
    const userId = claimsData.claims.sub;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing payment details' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!razorpayKeySecret || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Payment verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch amount from the pending deposit record (server-side truth)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: pendingDeposit } = await supabase
      .from('pending_razorpay_deposits')
      .select('amount, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', userId)
      .single();

    if (!pendingDeposit) {
      return new Response(
        JSON.stringify({ error: 'No matching deposit record found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pendingDeposit.status === 'completed') {
      // Already processed - return success without double-crediting
      const { data: currentProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single();
      return new Response(
        JSON.stringify({ success: true, newBalance: currentProfile?.wallet_balance || 0, bonusAmount: 0, gotBlueTick: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amount = pendingDeposit.amount;

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance, total_deposit, has_blue_check, referred_by, rank_balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isFirstDeposit = (profile.total_deposit || 0) === 0;
    let bonusAmount = 0;
    let shouldGetBlueTick = profile.has_blue_check;

    if (amount >= 1000) { bonusAmount = 100; shouldGetBlueTick = true; }

    const newTotalDeposit = (profile.total_deposit || 0) + amount;
    const newRankBalance = (profile.rank_balance || 0) + amount;
    if (!shouldGetBlueTick && newTotalDeposit >= 1000) { shouldGetBlueTick = true; }

    const newBalance = (profile.wallet_balance || 0) + amount + bonusAmount;

    await supabase.from('profiles').update({
      wallet_balance: newBalance, total_deposit: newTotalDeposit,
      has_blue_check: shouldGetBlueTick, rank_balance: newRankBalance
    }).eq('id', userId);

    // Mark deposit as completed
    await supabase.from('pending_razorpay_deposits').update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('razorpay_order_id', razorpay_order_id);

    await supabase.from('transactions').insert({
      user_id: userId, type: 'deposit', amount: amount + bonusAmount, status: 'completed',
      description: `Deposited Rs${amount}${bonusAmount > 0 ? ` + Rs${bonusAmount} bonus` : ''}`,
      razorpay_order_id, razorpay_payment_id
    });

    // Handle referral bonus
    const { data: minRefSetting } = await supabase.from('app_settings').select('value').eq('key', 'min_referral_amount').maybeSingle();
    const minReferralAmount = parseFloat(minRefSetting?.value) || 15;

    if (isFirstDeposit && profile.referred_by && amount >= minReferralAmount) {
      const { data: referrer } = await supabase.from('profiles').select('id, wallet_balance').eq('referral_code', profile.referred_by).maybeSingle();
      if (referrer) {
        await supabase.from('profiles').update({ wallet_balance: (referrer.wallet_balance || 0) + 10 }).eq('id', referrer.id);
        await supabase.from('transactions').insert({ user_id: referrer.id, type: 'referral', amount: 10, status: 'completed', description: 'Referral bonus - new user deposited' });
        await supabase.from('notifications').insert({ user_id: referrer.id, title: 'Referral Bonus! 🎉', message: 'You earned ₹10 because your referred user made their first deposit!', type: 'bonus' });
      }
    }

    // Sync to telegram wallet
    try {
      const { data: userProfile } = await supabase.from('profiles').select('email').eq('id', userId).single();
      if (userProfile?.email) {
        const tgMatch = userProfile.email.match(/^telegram_(\d+)@bot\.local$/);
        if (tgMatch) {
          const telegramId = parseInt(tgMatch[1]);
          const { data: tgWallet } = await supabase.from('telegram_wallets').select('balance, total_earned').eq('telegram_id', telegramId).maybeSingle();
          if (tgWallet) {
            await supabase.from('telegram_wallets').update({ balance: (tgWallet.balance || 0) + amount, total_earned: (tgWallet.total_earned || 0) + amount, updated_at: new Date().toISOString() }).eq('telegram_id', telegramId);
            await supabase.from('telegram_wallet_transactions').insert({ telegram_id: telegramId, type: 'deposit', amount, description: 'Deposit via Razorpay (Website)' });
          }
        }
      }
    } catch (syncErr) { console.error('Telegram sync error (non-fatal):', syncErr); }

    return new Response(
      JSON.stringify({ success: true, newBalance, bonusAmount, gotBlueTick: shouldGetBlueTick && !profile.has_blue_check }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error verifying payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
