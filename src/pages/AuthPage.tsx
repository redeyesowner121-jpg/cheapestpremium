import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone, Eye, EyeOff, Gift, ArrowLeft, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import appLogoFallback from '@/assets/app-logo.jpg';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, loginWithTelegram, user } = useAuth();
  const { settings } = useAppSettingsContext();
  const appLogo = settings.app_logo || appLogoFallback;
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySending, setRecoverySending] = useState(false);
  const [showTelegramCodeModal, setShowTelegramCodeModal] = useState(false);
  const [telegramCode, setTelegramCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    referralCode: '',
  });

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode.toUpperCase() }));
      setIsLogin(false);
    }

    const telegramCode = searchParams.get('telegramLogin');
    if (telegramCode) {
      setTelegramCode(telegramCode);
      setShowTelegramCodeModal(true);
    }

    // Auto-open Telegram login modal when visiting /auth/telegram
    if (location.pathname === '/auth/telegram') {
      setShowTelegramCodeModal(true);
    }
  }, [searchParams, location.pathname]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate('/');
      } else {
        await register(
          formData.email, 
          formData.password, 
          formData.name, 
          formData.phone,
          formData.referralCode
        );
        // Don't navigate - register shows verification toast if email confirmation needed
        // If auto-confirmed, user state change will trigger navigation via useEffect
      }
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async () => {
    setShowTelegramCodeModal(true);
    setLoading(false);
  };

  const handleTelegramCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramCode.trim()) {
      toast.error('Please enter the login code from Telegram');
      return;
    }

    setVerifyingCode(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-login`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code: telegramCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to verify code');
        return;
      }

      // Set the session returned by the edge function
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        toast.error('Failed to set session');
        return;
      }

      toast.success('Logged in successfully!');
      setShowTelegramCodeModal(false);
      setTelegramCode('');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!recoveryEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setRecoverySending(true);
    try {
      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminError || !adminRoles?.length) {
        toast.error('No admin found. Please try again later.');
        return;
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('name')
        .eq('email', recoveryEmail.trim())
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      for (const admin of adminRoles) {
        const { error: insertError } = await supabase.from('chat_messages').insert({
          user_id: admin.user_id,
          is_admin: false,
          message: `🔑 Password Recovery Request\n\nEmail: ${recoveryEmail.trim()}\nName: ${userProfile?.name || 'Unknown'}\n\nThis user is requesting password recovery. Please assist them.`,
        });
        if (insertError) console.error('Failed to notify admin:', insertError);
      }

      toast.success('Recovery request sent to admin! They will contact you soon.');
      setShowForgotPassword(false);
      setRecoveryEmail('');
    } catch (error) {
      toast.error('Failed to send recovery request');
    } finally {
      setRecoverySending(false);
    }
  };

  const headerSubtext = showForgotPassword
    ? 'Recover your password'
    : isLogin
    ? 'Welcome back!'
    : 'Create your account';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="gradient-primary pt-12 pb-20 px-6 text-center">
        <motion.img
          src={appLogo}
          alt={settings.app_name}
          className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        />
        <motion.h1
          className="text-2xl font-bold text-primary-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {settings.app_name}
        </motion.h1>
        <motion.p
          className="text-primary-foreground/80 text-sm mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {headerSubtext}
        </motion.p>
      </div>

      {/* Form Card */}
      <motion.div
        className="flex-1 -mt-12 bg-card rounded-t-3xl px-6 py-8"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {showForgotPassword ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="flex items-center gap-2 text-sm text-muted-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>

            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send a recovery request to the admin. They will contact you to help reset your password.
            </p>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Your Email Address"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-muted border-0"
                required
              />
            </div>

            <Button
              type="button"
              className="w-full h-12 btn-gradient rounded-xl font-semibold"
              disabled={recoverySending}
              onClick={handlePasswordRecovery}
            >
              {recoverySending ? 'Sending...' : 'Send Recovery Request'}
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-12 h-12 rounded-xl bg-muted border-0"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="Phone Number (optional)"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-12 h-12 rounded-xl bg-muted border-0"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 h-12 rounded-xl bg-muted border-0"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 pr-12 h-12 rounded-xl bg-muted border-0"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Eye className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {!isLogin && (
                <div className="relative">
                  <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Referral Code (Optional)"
                    value={formData.referralCode}
                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                    className="pl-12 h-12 rounded-xl bg-muted border-0 uppercase"
                  />
                </div>
              )}

              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 btn-gradient rounded-xl font-semibold"
                disabled={loading}
              >
                {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl font-medium border-border"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      toast.error('Google login failed');
                    }
                  } catch {
                    toast.error('Google login failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl font-medium bg-[#0088cc] hover:bg-[#0077b3] text-white border-0"
                onClick={handleTelegramLogin}
                disabled={loading}
              >
                <Send className="w-5 h-5 mr-2" />
                Continue with Telegram
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-semibold"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>

            {!isLogin && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            )}
          </>
        )}
      </motion.div>

      <Dialog open={showTelegramCodeModal} onOpenChange={setShowTelegramCodeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#0088cc]" />
              Telegram Login Code
            </DialogTitle>
            <DialogDescription>
              Open the Telegram bot and use /start to get your login code, then paste it below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTelegramCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Login Code</label>
              <Input
                type="text"
                placeholder="Paste your 6-digit code here"
                value={telegramCode}
                onChange={(e) => setTelegramCode(e.target.value.trim())}
                className="h-12 text-center text-lg tracking-widest uppercase"
                maxLength={20}
                autoFocus
                disabled={verifyingCode}
              />
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
              <p className="font-semibold mb-2">How to get your code:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open Telegram and find <strong>@Air1_Premium_bot</strong></li>
                <li>Tap the /start command or send /login</li>
                <li>Copy the 6-digit code provided</li>
                <li>Paste it in the field above</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowTelegramCodeModal(false);
                  setTelegramCode('');
                }}
                disabled={verifyingCode}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#0088cc] hover:bg-[#0077b3] text-white"
                disabled={verifyingCode || !telegramCode.trim()}
              >
                {verifyingCode ? 'Verifying...' : 'Login'}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-[#0088cc] hover:bg-transparent hover:text-[#0077b3]"
              onClick={() => window.open('https://t.me/Air1_Premium_bot', '_blank')}
            >
              <Send className="w-4 h-4 mr-2" />
              Open Telegram Bot
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;
