import { useEffect, useState } from 'react';

/**
 * Returns a live countdown string `MM:SS` until `target`, plus expired flag.
 * Updates every second. Returns null if no target.
 */
export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return { label: null, expired: false, ms: 0 };
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return { label: '00:00', expired: true, ms: 0 };
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, expired: false, ms };
}
