import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import appLogoFallback from '@/assets/app-logo.jpg';
import SEOHead from '@/components/SEOHead';

const TelegramAuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { settings } = useAppSettingsContext();
  const appLogo = settings.app_logo || appLogoFallback;
  const appName = settings.app_name || 'Cheapest Premiums';

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const prefill = searchParams.get('code') || searchParams.get('telegramLogin');
    if (prefill) setCode(prefill.trim().toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Please enter the login code from Telegram');
      return;
    }
    setVerifying(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-login`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Invalid or expired code');
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) {
        toast.error('Failed to set session');
        return;
      }
      toast.success('Logged in successfully!');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify code');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0088cc]/5 via-background to-primary/10 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      <SEOHead
        title="Telegram Login"
        description="Login to Cheapest Premiums instantly using your Telegram bot login code. Secure, fast, and your wallet auto-syncs."
        canonicalPath="/telegram/auth"
        noindex
      />

      {/* decorative orbs */}
      <div className="absolute top-10 -left-20 w-72 h-72 rounded-full bg-[#0088cc]/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-80 h-80 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

      <button
        onClick={() => navigate('/auth')}
        className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img src={appLogo} alt={appName} className="w-20 h-20 rounded-2xl shadow-xl object-cover" />
            <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#0088cc] flex items-center justify-center shadow-lg ring-4 ring-background">
              <Send className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Telegram Login</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Enter the 6-digit code from our Telegram bot
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#0088cc]" />
                Login Code
              </label>
              <Input
                type="text"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
                className="h-14 text-center text-2xl font-bold tracking-[0.4em] uppercase"
                maxLength={20}
                autoFocus
                disabled={verifying}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#0088cc] hover:bg-[#0077b3] text-white text-base font-semibold rounded-xl shadow-lg"
              disabled={verifying || !code.trim()}
            >
              {verifying ? 'Verifying…' : 'Login Now'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">No code?</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-[#0088cc]/40 text-[#0088cc] hover:bg-[#0088cc]/10 hover:text-[#0088cc]"
              onClick={() => window.open('https://t.me/Air1_Premium_bot?start=login', '_blank')}
            >
              <Send className="w-4 h-4 mr-2" />
              Open Telegram Bot
            </Button>
          </form>
        </div>

        {/* Steps */}
        <div className="mt-6 bg-muted/40 backdrop-blur border border-border/50 rounded-2xl p-4 text-sm space-y-3">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            How to get your code
          </p>
          <ol className="space-y-2 text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0088cc]/15 text-[#0088cc] text-xs font-bold flex items-center justify-center">1</span>
              <span>Open <strong className="text-foreground">@Air1_Premium_bot</strong> on Telegram</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0088cc]/15 text-[#0088cc] text-xs font-bold flex items-center justify-center">2</span>
              <span>Tap <strong className="text-foreground">/login</strong> or use the Login menu</span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0088cc]/15 text-[#0088cc] text-xs font-bold flex items-center justify-center">3</span>
              <span>Copy the 6-digit code and paste it above</span>
            </li>
          </ol>
          <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Wallet, orders & purchases auto-sync after login
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TelegramAuthPage;
