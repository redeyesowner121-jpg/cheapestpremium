// Tiny localStorage-backed cache with TTL.
// Used to make pages render instantly when the user navigates back.

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function readCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; d: T };
    if (!parsed || typeof parsed.t !== 'number') return null;
    if (Date.now() - parsed.t > ttlMs) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}
