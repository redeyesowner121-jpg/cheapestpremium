import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, amount } = await req.json();

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

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance, total_deposit, has_blue_check, referred_by, rank_balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is first deposit and user was referred
    const isFirstDeposit = (profile.total_deposit || 0) === 0;
    let referralBonusGiven = false;

    let bonusAmount = 0;
    let shouldGetBlueTick = profile.has_blue_check;

    // Check for Rs 1000 single deposit bonus
    if (amount >= 1000) {
      bonusAmount = 100;
      shouldGetBlueTick = true;
    }

    const newTotalDeposit = (profile.total_deposit || 0) + amount;
    const newRankBalance = (profile.rank_balance || 0) + amount;

    // Check for total Rs 1000 deposit blue tick
    if (!shouldGetBlueTick && newTotalDeposit >= 1000) {
      shouldGetBlueTick = true;
    }

    const newBalance = (profile.wallet_balance || 0) + amount + bonusAmount;

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        wallet_balance: newBalance,
        total_deposit: newTotalDeposit,
        has_blue_check: shouldGetBlueTick,
        rank_balance: newRankBalance
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'deposit',
      amount: amount + bonusAmount,
      status: 'completed',
      description: `Deposited Rs${amount}${bonusAmount > 0 ? ` + Rs${bonusAmount} bonus` : ''}`,
      razorpay_order_id,
      razorpay_payment_id
    });

    // Get configurable minimum referral amount
    const { data: minRefSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'min_referral_amount')
      .maybeSingle();
    const minReferralAmount = parseFloat(minRefSetting?.value) || 15;

    // Handle referral bonus on first deposit (skip if amount < minimum)
    if (isFirstDeposit && profile.referred_by && amount >= minReferralAmount) {
      // Find the referrer by referral code
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, wallet_balance')
        .eq('referral_code', profile.referred_by)
        .maybeSingle();

      if (referrer) {
        // Give ₹10 to referrer
        await supabase
          .from('profiles')
          .update({ wallet_balance: (referrer.wallet_balance || 0) + 10 })
          .eq('id', referrer.id);

        await supabase.from('transactions').insert({
          user_id: referrer.id,
          type: 'referral',
          amount: 10,
          status: 'completed',
          description: `Referral bonus - new user deposited`
        });

        // Notify referrer
        await supabase.from('notifications').insert({
          user_id: referrer.id,
          title: 'Referral Bonus! 🎉',
          message: 'You earned ₹10 because your referred user made their first deposit!',
          type: 'bonus'
        });

        referralBonusGiven = true;
        console.log('Referral bonus given to:', referrer.id);
      }
    }

    console.log('Payment verified and wallet updated for user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        bonusAmount,
        gotBlueTick: shouldGetBlueTick && !profile.has_blue_check
      }),
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
