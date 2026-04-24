/**
 * Parse stock access_link content into structured credentials.
 * Supports:
 *  - Labeled format: "Email: x\nPassword: y\n2FA: z"
 *  - Pipe-separated: "x|y|z"
 *  - Plain URL or text
 */
export interface ParsedCredential {
  email?: string;
  password?: string;
  twoFASecret?: string;
  link?: string;
  extras?: { label: string; value: string }[];
  raw: string;
  hasStructured: boolean;
}

const EMAIL_KEYS = ['email', 'id', 'username', 'user', 'login', 'mail'];
const PASS_KEYS = ['password', 'pass', 'pwd', 'pw'];
const TFA_KEYS = ['2fa', 'totp', '2fa secret', '2fa code', 'authenticator', 'otp secret', 'secret', 'mfa'];
const LINK_KEYS = ['link', 'url', 'access', 'website', 'site'];

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
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
  if (!raw) return { raw: '', hasStructured: false };
  const trimmed = raw.trim();

  // Try labeled multi-line first
  const labeled: ParsedCredential = { raw: trimmed, hasStructured: false, extras: [] };
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let labeledMatchCount = 0;
  for (const line of lines) {
    const m = line.match(/^([^:|=]+)\s*[:=]\s*(.+)$/);
    if (m) {
      const key = m[1];
      const val = m[2].trim();
      const type = classify(key);
      if (type === 'email') { labeled.email = val; labeledMatchCount++; }
      else if (type === 'password') { labeled.password = val; labeledMatchCount++; }
      else if (type === 'twoFA') { labeled.twoFASecret = val.replace(/\s+/g, ''); labeledMatchCount++; }
      else if (type === 'link') { labeled.link = val; labeledMatchCount++; }
      else labeled.extras!.push({ label: key.trim(), value: val });
    }
  }

  if (labeledMatchCount >= 1) {
    labeled.hasStructured = true;
    return labeled;
  }

  // Try pipe-separated single line: email|password[|2fa]
  if (lines.length === 1 && trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const out: ParsedCredential = { raw: trimmed, hasStructured: true };
      out.email = parts[0];
      out.password = parts[1];
      if (parts[2]) out.twoFASecret = parts[2].replace(/\s+/g, '');
      if (parts[3] && isUrl(parts[3])) out.link = parts[3];
      return out;
    }
  }

  // Plain URL
  if (isUrl(trimmed)) {
    return { raw: trimmed, link: trimmed, hasStructured: false };
  }

  // Unstructured text
  return { raw: trimmed, hasStructured: false };
}

/**
 * Parse a bulk import block separated by `---` (or 3+ dashes / blank lines)
 */
export function parseBulkImport(text: string): string[] {
  if (!text?.trim()) return [];
  // Split by --- on its own line, or by 2+ blank lines
  const blocks = text
    .split(/\n\s*-{3,}\s*\n|\n\s*\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks;
}
