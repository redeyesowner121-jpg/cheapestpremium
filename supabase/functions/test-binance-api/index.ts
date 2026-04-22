const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createHmac } from "node:crypto";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { apiKey, apiSecret } = await req.json();

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: 'API Key and Secret are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any = { apiKey: apiKey.slice(0, 8) + '...' + apiKey.slice(-4), tests: [] };

    // Test 1: Server time (no auth needed, tests connectivity)
    try {
      const timeRes = await fetch('https://api.binance.com/api/v3/time');
      const timeData = await timeRes.json();
      results.tests.push({
        name: 'Binance Connectivity',
        status: timeRes.ok ? 'pass' : 'fail',
        detail: timeRes.ok ? `Server time: ${new Date(timeData.serverTime).toISOString()}` : JSON.stringify(timeData)
      });
    } catch (e) {
      results.tests.push({ name: 'Binance Connectivity', status: 'fail', detail: String(e) });
    }

    // Test 2: Account info (tests API key + signature)
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = createHmac('sha256', apiSecret).update(queryString).digest('hex');

      const accountRes = await fetch(
        `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': apiKey } }
      );
      const accountData = await accountRes.json();

      if (accountRes.ok) {
        const permissions = accountData.permissions || [];
        results.tests.push({
          name: 'API Key Authentication',
          status: 'pass',
          detail: `Authenticated! Permissions: ${permissions.join(', ')}`
        });
        results.tests.push({
          name: 'Account Permissions',
          status: 'pass',
          detail: `canTrade: ${accountData.canTrade}, canWithdraw: ${accountData.canWithdraw}, canDeposit: ${accountData.canDeposit}`
        });
      } else {
        results.tests.push({
          name: 'API Key Authentication',
          status: 'fail',
          detail: `Code: ${accountData.code} — ${accountData.msg}`,
          code: accountData.code
        });
      }
    } catch (e) {
      results.tests.push({ name: 'API Key Authentication', status: 'fail', detail: String(e) });
    }

    // Test 3: Binance Pay API (tests C2C transfer history — what verify-binance-payment uses)
    try {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
      const body = JSON.stringify({ startTimestamp: timestamp - 60000, endTimestamp: timestamp, limit: 1 });
      const payload = `${timestamp}\n${nonce}\n${body}\n`;
      const signature = createHmac('sha512', apiSecret).update(payload).digest('hex').toUpperCase();

      const payRes = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v3/bill/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'BinancePay-Timestamp': String(timestamp),
          'BinancePay-Nonce': nonce,
          'BinancePay-Certificate-SN': apiKey,
          'BinancePay-Signature': signature,
        },
        body,
      });
      const payData = await payRes.json();

      if (payData.status === 'SUCCESS') {
        results.tests.push({
          name: 'Binance Pay API',
          status: 'pass',
          detail: `Pay API working! Bills found: ${payData.data?.total || 0}`
        });
      } else {
        results.tests.push({
          name: 'Binance Pay API',
          status: 'fail',
          detail: `${payData.code}: ${payData.errorMessage || payData.msg}`,
          code: payData.code
        });
      }
    } catch (e) {
      results.tests.push({ name: 'Binance Pay API', status: 'fail', detail: String(e) });
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
