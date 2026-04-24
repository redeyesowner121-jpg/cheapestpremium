// ===== CREDENTIAL PARSER + TOTP GENERATOR (Deno) =====
// Mirrors src/lib/credentialParser.ts + src/lib/totpGenerator.ts so the bot
// can generate live 2FA codes on demand.

const EMAIL_KEYS = ['email', 'id', 'username', 'user', 'login', 'mail'];
const PASS_KEYS = ['password', 'pass', 'pwd', 'pw'];
const TFA_KEYS = ['2fa', 'totp', '2fa secret', '2fa code', 'authenticator', 'otp secret', 'secret', 'mfa'];
const LINK_KEYS = ['link', 'url', 'access', 'website', 'site'];

export interface ParsedCredential {
  email?: string;
  password?: string;
  twoFASecret?: string;
  link?: string;
}

function classify(key: string): 'email' | 'password' | 'twoFA' | 'link' | null {
  const k = key.trim().toLowerCase().replace(/[_\-\s]+/g, ' ');
  if (TFA_KEYS.some((t) => k === t || k.startsWith(t))) return 'twoFA';
  if (EMAIL_KEYS.includes(k)) return 'email';
  if (PASS_KEYS.includes(k)) return 'password';
  if (LINK_KEYS.includes(k)) return 'link';
  return null;
}

export function parseCredential(raw: string): ParsedCredential {
  if (!raw) return {};
  const trimmed = raw.trim();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedCredential = {};
  let matched = 0;

  for (const line of lines) {
    const m = line.match(/^([^:|=]+)\s*[:=]\s*(.+)$/);
    if (!m) continue;
    const type = classify(m[1]);
    const val = m[2].trim();
    if (type === 'email') { out.email = val; matched++; }
    else if (type === 'password') { out.password = val; matched++; }
    else if (type === 'twoFA') { out.twoFASecret = val.replace(/\s+/g, ''); matched++; }
    else if (type === 'link') { out.link = val; matched++; }
  }
  if (matched > 0) return out;

  // Pipe-separated fallback: email|pass|2fa
  if (lines.length === 1 && trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.email = parts[0];
      out.password = parts[1];
      if (parts[2]) out.twoFASecret = parts[2].replace(/\s+/g, '');
    }
  }
  return out;
}

// ===== Base32 decode (RFC 4648) =====
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 character: ' + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Generate current TOTP code (RFC 6238). Default: 6 digits, 30s period, SHA-1.
 * Returns { code, secondsLeft } or null on invalid secret.
 */
export async function generateTOTP(secret: string): Promise<{ code: string; secondsLeft: number } | null> {
  try {
    const key = base32Decode(secret);
    const period = 30;
    const counter = Math.floor(Date.now() / 1000 / period);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(0, Math.floor(counter / 0x100000000));
    view.setUint32(4, counter & 0xffffffff);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf));
    const offset = sig[sig.length - 1] & 0x0f;
    const binary =
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);
    const code = String(binary % 1_000_000).padStart(6, '0');
    const secondsLeft = period - Math.floor(Date.now() / 1000) % period;
    return { code, secondsLeft };
  } catch (e) {
    console.error('[TOTP] generation failed:', e);
    return null;
  }
}

/**
 * Look up the access_link/credentials delivered for a given telegram_order_id.
 * Falls back to product/variation repeated link if no consumed stock item is found.
 */
export async function findOrderCredentials(
  supabase: any,
  telegramOrderId: string
): Promise<string | null> {
  // 1. Stock item consumed for this order (unique mode)
  try {
    const { data: stockRows } = await supabase
      .from('product_stock_items')
      .select('access_link')
      .eq('telegram_order_id', telegramOrderId)
      .limit(1);
    if (stockRows?.[0]?.access_link) return stockRows[0].access_link;
  } catch {}

  // 2. Look up product + variation from order, fall back to repeated link
  try {
    const { data: order } = await supabase
      .from('telegram_orders')
      .select('product_id, product_name')
      .eq('id', telegramOrderId)
      .single();
    if (!order?.product_id) return null;

    // Try variation match first
    if (order.product_name) {
      const { data: vars } = await supabase
        .from('product_variations')
        .select('name, access_link')
        .eq('product_id', order.product_id)
        .eq('is_active', true);
      if (vars?.length) {
        const matched = vars
          .filter((v: any) => order.product_name.toLowerCase().includes(v.name.toLowerCase()))
          .sort((a: any, b: any) => b.name.length - a.name.length)[0];
        if (matched?.access_link) return matched.access_link;
      }
    }

    const { data: product } = await supabase
      .from('products')
      .select('access_link')
      .eq('id', order.product_id)
      .single();
    return product?.access_link || null;
  } catch {
    return null;
  }
}
