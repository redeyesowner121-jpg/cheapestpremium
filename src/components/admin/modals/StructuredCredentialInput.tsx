import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mail, Key, Shield, Link2, Pencil, Sparkles } from 'lucide-react';
import { TOTP, Secret } from 'otpauth';
import { parseCredential } from '@/lib/credentialParser';

interface Props {
  value: string;
  onChange: (combined: string) => void;
  compact?: boolean;
}

/**
 * Structured input with 3 dedicated fields (Email / Password / 2FA Secret)
 * + optional Link. Combines them into the canonical labeled format that
 * CredentialDisplay + Telegram delivery already understand.
 *
 * Also supports a "Raw" mode toggle for power users.
 */
const StructuredCredentialInput: React.FC<Props> = ({ value, onChange, compact }) => {
  const [mode, setMode] = useState<'structured' | 'raw'>('structured');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFA, setTwoFA] = useState('');
  const [link, setLink] = useState('');
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Hydrate from incoming value
  useEffect(() => {
    if (!value) {
      setEmail(''); setPassword(''); setTwoFA(''); setLink('');
      return;
    }
    const p = parseCredential(value);
    setEmail(p.email || '');
    setPassword(p.password || '');
    setTwoFA(p.twoFASecret || '');
    setLink(p.link || '');
    // If parser couldn't structure it, fall back to raw mode
    if (!p.hasStructured && value.trim()) setMode('raw');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build labeled string and emit upward
  useEffect(() => {
    if (mode !== 'structured') return;
    const lines: string[] = [];
    if (email.trim()) lines.push(`Email: ${email.trim()}`);
    if (password.trim()) lines.push(`Password: ${password.trim()}`);
    if (twoFA.trim()) lines.push(`2FA: ${twoFA.replace(/\s+/g, '')}`);
    if (link.trim()) lines.push(`Link: ${link.trim()}`);
    onChange(lines.join('\n'));
  }, [email, password, twoFA, link, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live OTP preview to verify the secret is valid
  useEffect(() => {
    if (!twoFA.trim()) { setOtpPreview(null); setOtpError(null); return; }
    try {
      const cleaned = twoFA.replace(/\s+/g, '').toUpperCase();
      const totp = new TOTP({
        secret: Secret.fromBase32(cleaned),
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      });
      const tick = () => setOtpPreview(totp.generate());
      tick();
      setOtpError(null);
      const i = setInterval(tick, 1000);
      return () => clearInterval(i);
    } catch {
      setOtpPreview(null);
      setOtpError('Invalid Base32 secret');
    }
  }, [twoFA]);

  if (mode === 'raw') {
    return (
      <div className="space-y-1.5">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Email: x@y.com\nPassword: pass\n2FA: SECRET`}
          className={`font-mono ${compact ? 'text-[11px] min-h-[80px]' : 'text-xs min-h-[110px]'}`}
        />
        <button
          type="button"
          onClick={() => setMode('structured')}
          className="text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" /> Switch to structured fields
        </button>
      </div>
    );
  }

  const inputCls = compact ? 'h-8 text-[11px]' : 'h-9 text-xs';

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-1.5">
        <div className="relative">
          <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email / Username"
            className={`${inputCls} pl-7`}
          />
        </div>
        <div className="relative">
          <Key className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={`${inputCls} pl-7 font-mono`}
          />
        </div>
        <div className="relative">
          <Shield className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={twoFA}
            onChange={(e) => setTwoFA(e.target.value)}
            placeholder="2FA Secret (Base32, optional)"
            className={`${inputCls} pl-7 font-mono uppercase`}
          />
          {otpPreview && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {otpPreview}
            </span>
          )}
        </div>
        {otpError && <p className="text-[10px] text-destructive">⚠ {otpError}</p>}
        <div className="relative">
          <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (optional)"
            className={`${inputCls} pl-7`}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMode('raw')}
        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
      >
        <Pencil className="w-3 h-3" /> Raw / multi-line mode
      </button>
    </div>
  );
};

export default StructuredCredentialInput;
