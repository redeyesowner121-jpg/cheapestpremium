// Shared QR payload encoder/decoder for in-app wallet transfers.
// Uses a versioned prefix so we can extend later without breaking older builds.

export type QrPayload = {
  v: 1;
  type: 'pay';
  uid: string;          // recipient profile id
  email?: string;       // optional, for display fallback
  name?: string;        // optional display name
  amount?: number;      // optional amount (request QR)
  note?: string;
};

const PREFIX = 'CPW1:'; // Cheapest-Premium Wallet v1

export function encodeQr(payload: QrPayload): string {
  return PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export function decodeQr(text: string): QrPayload | null {
  try {
    if (!text) return null;
    const t = text.trim();
    if (!t.startsWith(PREFIX)) return null;
    const json = decodeURIComponent(escape(atob(t.slice(PREFIX.length))));
    const obj = JSON.parse(json);
    if (obj?.type === 'pay' && obj?.uid) return obj as QrPayload;
    return null;
  } catch {
    return null;
  }
}
