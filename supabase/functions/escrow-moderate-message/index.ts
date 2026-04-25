// Escrow message moderation using Lovable AI Gateway.
// Detects obfuscated contact-sharing attempts (emails, phones, usernames,
// social handles, off-platform deal proposals) that bypass regex filters.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a strict content moderator for an on-platform escrow chat.
Block ANY attempt to share contact details or move the conversation off-platform, even when obfuscated.

Block (return blocked=true) if the message contains, even disguised with spaces, dots, words, emojis, leet-speak, foreign scripts or creative spacing:
- Email addresses (e.g. "rkr at gmail dot com", "rkr [at] gmail", "rkr@gmail .com")
- Phone / WhatsApp numbers (any 7+ digit sequence that looks like a contact, including spaced/dashed)
- Usernames or handles for Telegram, WhatsApp, Instagram, Facebook, Discord, Snapchat, Signal, X/Twitter (e.g. "tg me at rkr", "my insta is rkr_", "@rkr on telegram", "find me on tg", "wa me")
- External chat / call links (t.me, wa.me, telegram.me, discord.gg, signal.me, http/https links, "google me", QR codes)
- Direct invitations to deal outside the escrow ("send money directly", "pay me on upi", "let's do it outside", "add me on …", "DM me on …", upi IDs like xyz@okaxis)
- Crypto wallet addresses or upi IDs (anything matching name@bank pattern, or long base58/hex addresses)

Allow normal trade discussion: product details, delivery timing, prices, polite chat, dispute reasons.

Respond ONLY with strict JSON: {"blocked": boolean, "reason": string}. Reason must be short (max 80 chars), user-friendly, in English. If allowed, reason can be "ok".`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (typeof message !== 'string' || !message.trim()) {
      return json({ blocked: false, reason: 'empty' });
    }
    if (message.length > 1000) {
      return json({ blocked: true, reason: 'Message too long.' });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      // Fail-open with a soft warning header so chat keeps working if AI is down.
      console.error('LOVABLE_API_KEY missing');
      return json({ blocked: false, reason: 'ai-unavailable' });
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) return json({ blocked: false, reason: 'rate-limited' });
    if (resp.status === 402) return json({ blocked: false, reason: 'credits-out' });
    if (!resp.ok) {
      console.error('AI moderation failed', resp.status, await resp.text().catch(() => ''));
      return json({ blocked: false, reason: 'ai-error' });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed: { blocked?: boolean; reason?: string } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return json({
      blocked: !!parsed.blocked,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : (parsed.blocked ? 'Sharing contacts is not allowed.' : 'ok'),
    });
  } catch (e) {
    console.error('moderate-message exception', e);
    return json({ blocked: false, reason: 'exception' });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
