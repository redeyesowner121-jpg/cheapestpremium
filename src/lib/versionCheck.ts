// Detect new deployments and force-refresh stale clients.
// Strategy: poll index.html for a hash of its <script type="module"> src.
// When the bundle URL changes (Vite emits a new hashed filename per build),
// unregister all service workers, clear caches, and reload.

const POLL_INTERVAL_MS = 60_000; // every 60s
let currentBundle: string | null = null;
let started = false;

async function fetchBundleId(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    // Match Vite's hashed entry like /assets/index-abc123.js
    const match = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*type="module"/i)
      || html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function reloadFresh() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore — still reload
  }
  // Hard reload bypassing HTTP cache
  window.location.replace(window.location.href.split('#')[0] + (window.location.search ? '&' : '?') + '_r=' + Date.now());
}

export function startVersionCheck() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const check = async () => {
    const next = await fetchBundleId();
    if (next && currentBundle && next !== currentBundle) {
      console.info('[versionCheck] new build detected, refreshing…');
      await reloadFresh();
    }
  };

  // Capture initial bundle id, then quick re-check after 5s to catch fresh deploys
  fetchBundleId().then((id) => {
    currentBundle = id;
    setTimeout(check, 5000);
  });

  setInterval(check, POLL_INTERVAL_MS);
  // Also check when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
