import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all users with rank_balance > 0
    const { data: users, error: fetchError } = await supabase
      .from('profiles')
      .select('id, rank_balance, name, email')
      .gt('rank_balance', 0);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedCount = 0;
    const decayRate = 0.30; // 30% decay

    for (const user of users || []) {
      const currentBalance = user.rank_balance || 0;
      const decayAmount = currentBalance * decayRate;
      const newBalance = Math.round((currentBalance - decayAmount) * 100) / 100;

      // Update user's rank_balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          rank_balance: newBalance,
          last_rank_decay: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error updating user ${user.id}:`, updateError);
        continue;
      }

      // Create notification about decay
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Monthly Rank Update',
        message: `Your rank balance decreased by ₹${decayAmount.toFixed(0)} (30% monthly decay). New balance: ₹${newBalance.toFixed(0)}. Deposit to maintain your rank!`,
        type: 'rank'
      });

      // Record in transactions
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'rank_decay',
        amount: -decayAmount,
        status: 'completed',
        description: `Monthly rank decay (30%): -₹${decayAmount.toFixed(0)}`
      });

      processedCount++;
      console.log(`Processed decay for user ${user.id}: ₹${currentBalance} -> ₹${newBalance}`);
    }

    console.log(`Monthly rank decay completed. Processed ${processedCount} users.`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        message: 'Monthly rank decay completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in rank decay:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
