import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

async function creditWallet(supabase: any, userId: string, amount: number, razorpayOrderId: string, razorpayPaymentId: string) {
  // Check if already processed (idempotency)
  const { data: existing } = await supabase
    .from('pending_razorpay_deposits')
    .select('status')
    .eq('razorpay_order_id', razorpayOrderId)
    .single();

  if (existing?.status === 'completed') {
    console.log('Already processed:', razorpayOrderId);
    return { alreadyProcessed: true };
  }

  // Get current profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance, total_deposit, has_blue_check, referred_by, rank_balance')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Profile not found:', profileError);
    return { error: 'User not found' };
  }

  const isFirstDeposit = (profile.total_deposit || 0) === 0;

  let bonusAmount = 0;
  let shouldGetBlueTick = profile.has_blue_check;

  if (amount >= 1000) {
    bonusAmount = 100;
    shouldGetBlueTick = true;
  }

  const newTotalDeposit = (profile.total_deposit || 0) + amount;
  const newRankBalance = (profile.rank_balance || 0) + amount;

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
    return { error: 'Failed to update wallet' };
  }

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'deposit',
    amount: amount + bonusAmount,
    status: 'completed',
    description: `Deposited Rs${amount}${bonusAmount > 0 ? ` + Rs${bonusAmount} bonus` : ''}`,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId
  });

  // Mark pending deposit as completed
  await supabase.from('pending_razorpay_deposits')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('razorpay_order_id', razorpayOrderId);

  // Handle referral bonus on first deposit
  const { data: minRefSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'min_referral_amount')
    .maybeSingle();
  const minReferralAmount = parseFloat(minRefSetting?.value) || 15;

  if (isFirstDeposit && profile.referred_by && amount >= minReferralAmount) {
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id, wallet_balance')
      .eq('referral_code', profile.referred_by)
      .maybeSingle();

    if (referrer) {
      await supabase.from('profiles')
        .update({ wallet_balance: (referrer.wallet_balance || 0) + 10 })
        .eq('id', referrer.id);

      await supabase.from('transactions').insert({
        user_id: referrer.id, type: 'referral', amount: 10,
        status: 'completed', description: 'Referral bonus - new user deposited'
      });

      await supabase.from('notifications').insert({
        user_id: referrer.id, title: 'Referral Bonus! 🎉',
        message: 'You earned ₹10 because your referred user made their first deposit!',
        type: 'bonus'
      });
    }
  }

  // Sync to telegram wallet if linked
  try {
    const { data: userProfile } = await supabase
      .from('profiles').select('email').eq('id', userId).single();

    if (userProfile?.email) {
      const tgMatch = userProfile.email.match(/^telegram_(\d+)@bot\.local$/);
      if (tgMatch) {
        const telegramId = parseInt(tgMatch[1]);
        const { data: tgWallet } = await supabase
          .from('telegram_wallets')
          .select('balance, total_earned')
          .eq('telegram_id', telegramId)
          .maybeSingle();

        if (tgWallet) {
          await supabase.from('telegram_wallets').update({
            balance: (tgWallet.balance || 0) + amount,
            total_earned: (tgWallet.total_earned || 0) + amount,
            updated_at: new Date().toISOString(),
          }).eq('telegram_id', telegramId);

          await supabase.from('telegram_wallet_transactions').insert({
            telegram_id: telegramId, type: 'deposit', amount,
            description: `Deposit via Razorpay (Website)`,
          });
        }
      }
    }
  } catch (syncErr) {
    console.error('Telegram wallet sync error (non-fatal):', syncErr);
  }

  return {
    success: true, newBalance, bonusAmount,
    gotBlueTick: shouldGetBlueTick && !profile.has_blue_check
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!razorpayKeySecret) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // If called from webhook (has signature), verify it
    if (signature) {
      const expectedSignature = createHmac("sha256", razorpayKeySecret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error('Webhook signature verification failed');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const payload = JSON.parse(body);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle webhook event
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      if (!payment) {
        return new Response(JSON.stringify({ status: 'ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const orderId = payment.order_id;
      const amount = payment.amount / 100; // paise to rupees
      const paymentId = payment.id;

      // Find the pending deposit
      const { data: pendingDeposit } = await supabase
        .from('pending_razorpay_deposits')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .single();

      if (!pendingDeposit) {
        console.log('No pending deposit found for order:', orderId);
        return new Response(JSON.stringify({ status: 'no_deposit_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (pendingDeposit.status === 'completed') {
        return new Response(JSON.stringify({ status: 'already_processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await creditWallet(supabase, pendingDeposit.user_id, pendingDeposit.amount, orderId, paymentId);
      console.log('Webhook credit result:', result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle direct client call (from razorpay-verify replacement)
    if (payload.razorpay_order_id && payload.razorpay_payment_id && payload.razorpay_signature) {
      // Verify signature
      const verifyBody = payload.razorpay_order_id + "|" + payload.razorpay_payment_id;
      const expectedSig = createHmac("sha256", razorpayKeySecret)
        .update(verifyBody)
        .digest("hex");

      if (expectedSig !== payload.razorpay_signature) {
        return new Response(JSON.stringify({ error: 'Payment verification failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await creditWallet(
        supabase, payload.userId, payload.amount,
        payload.razorpay_order_id, payload.razorpay_payment_id
      );

      if (result.alreadyProcessed) {
        // Fetch current balance to return
        const { data: p } = await supabase.from('profiles')
          .select('wallet_balance').eq('id', payload.userId).single();
        return new Response(JSON.stringify({
          success: true, newBalance: p?.wallet_balance || 0,
          bonusAmount: 0, gotBlueTick: false
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        newBalance: result.newBalance,
        bonusAmount: result.bonusAmount,
        gotBlueTick: result.gotBlueTick
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ status: 'ignored' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
