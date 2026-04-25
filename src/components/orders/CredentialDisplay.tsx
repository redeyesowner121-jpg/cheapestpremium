import React, { useState } from 'react';
import { Copy, Eye, EyeOff, ExternalLink, Mail, Key, ShieldCheck, Link2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseCredential } from '@/lib/credentialParser';
import { useTOTP } from '@/lib/totpGenerator';
import { motion } from 'framer-motion';

interface Props {
  rawCredential: string;
}

const copy = (val: string, label: string) => {
  navigator.clipboard.writeText(val);
  toast.success(`${label} copied!`);
};

const Field: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
}> = ({ icon, label, value, mono, secret }) => {
  const [revealed, setRevealed] = useState(!secret);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <code className={`flex-1 text-xs ${mono ? 'font-mono' : ''} bg-background/80 rounded-lg px-2.5 py-2 break-all text-foreground border border-border/50`}>
          {revealed ? value : '••••••••••••'}
        </code>
        {secret && (
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copy(value, label)}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

const TwoFAWidget: React.FC<{ secret: string }> = ({ secret }) => {
  const { code, secondsLeft, error } = useTOTP(secret);
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  const isExpiring = secondsLeft <= 5;
  const progress = (secondsLeft / 30) * 100;

  if (error) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <ShieldCheck className="w-3 h-3" />
          Live 2FA Code
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
          <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Live OTP unavailable right now. Please contact support if you need a code.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        <ShieldCheck className="w-3 h-3" />
        Live 2FA Code
        <span className="ml-auto normal-case text-[10px] text-muted-foreground">Auto-refreshing</span>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <motion.div
            key={code}
            initial={{ opacity: 0.4, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <div className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">
              {formattedCode}
            </div>
          </motion.div>
          <div className="relative w-10 h-10 shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                className={isExpiring ? 'stroke-destructive' : 'stroke-primary'}
                strokeWidth="3"
                strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${isExpiring ? 'text-destructive' : 'text-foreground'}`}>
              {secondsLeft}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 mt-2 text-xs border-primary/30 hover:bg-primary/10"
          onClick={() => copy(code, '2FA Code')}
        >
          <Copy className="w-3 h-3 mr-1.5" /> Copy Code
        </Button>
      </div>
    </div>
  );
};

const UnstructuredView: React.FC<{ parsed: ReturnType<typeof parseCredential> }> = ({ parsed }) => {
  const [revealed, setRevealed] = useState(false);
  return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-background/80 rounded-lg px-2.5 py-2 break-all text-foreground border border-border/50">
            {revealed ? parsed.raw : '••••••••••••••••••••'}
          </code>
          <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            className="flex-1 rounded-lg text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            onClick={() => copy(parsed.raw, 'Content')}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
          </Button>
          {parsed.link && (
            <Button
              size="sm"
              className="flex-1 rounded-lg text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => window.open(parsed.link, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
            </Button>
          )}
        </div>
      </div>
  );
};

const CredentialDisplay: React.FC<Props> = ({ rawCredential }) => {
  const parsed = parseCredential(rawCredential);

  // Unstructured: fall back to original "link" display
  if (!parsed.hasStructured && !parsed.email && !parsed.password && !parsed.twoFASecret) {
    return <UnstructuredView parsed={parsed} />;
  }

  return (
    <div className="space-y-2.5">
      {parsed.email && <Field icon={<Mail className="w-3 h-3" />} label="Email / Username" value={parsed.email} mono />}
      {parsed.password && <Field icon={<Key className="w-3 h-3" />} label="Password" value={parsed.password} mono secret />}
      {parsed.twoFASecret && <TwoFAWidget secret={parsed.twoFASecret} />}
      {parsed.link && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <Link2 className="w-3 h-3" /> Access Link
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => window.open(parsed.link, '_blank')}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Link
          </Button>
        </div>
      )}
      {parsed.extras?.map((ex, i) => (
        <Field key={i} icon={<Key className="w-3 h-3" />} label={ex.label} value={ex.value} mono />
      ))}
      <p className="text-[10px] text-muted-foreground text-center pt-1">⚠️ Confidential — do not share</p>
    </div>
  );
};

export default CredentialDisplay;
