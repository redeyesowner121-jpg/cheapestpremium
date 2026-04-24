import { useEffect, useState } from 'react';
import { TOTP, Secret } from 'otpauth';

/**
 * Hook that returns the current 6-digit TOTP code and seconds remaining.
 * Auto-refreshes every second.
 */
export function useTOTP(secret: string | undefined | null) {
  const [code, setCode] = useState<string>('------');
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!secret) {
      setCode('------');
      setError(null);
      return;
    }

    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    let totp: TOTP;
    try {
      totp = new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(cleanSecret),
      });
      setError(null);
    } catch (e) {
      setError('Invalid 2FA secret format');
      setCode('------');
      return;
    }

    const tick = () => {
      try {
        const now = Date.now();
        const period = 30;
        const remaining = period - Math.floor((now / 1000) % period);
        setCode(totp.generate());
        setSecondsLeft(remaining);
      } catch {
        setError('Failed to generate code');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  return { code, secondsLeft, error };
}
