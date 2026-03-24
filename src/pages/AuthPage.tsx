import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone, Eye, EyeOff, Gift, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import appLogo from '@/assets/app-logo.jpg';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, loginWithTelegram, user } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySending, setRecoverySending] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    referralCode: '',
  });

  // Check for referral code in URL and auto-switch to signup mode
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode.toUpperCase() }));
      setIsLogin(false);
    }
  }, [searchParams]);

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
      } else {
        await register(
          formData.email, 
          formData.password, 
          formData.name, 
          formData.phone,
          formData.referralCode
        );
      }
      navigate('/');
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramLogin = async () => {
    setLoading(true);
    try {
      await loginWithTelegram();
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    if (!recoveryEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setRecoverySending(true);
    try {
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin']);

      if (!adminRoles?.length) {
        toast.error('No admin found. Please try again later.');
        return;
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('email', recoveryEmail.trim())
        .maybeSingle();

      for (const admin of adminRoles) {
        await supabase.from('chat_messages').insert({
          user_id: admin.user_id,
          is_admin: false,
          message: `🔑 Password Recovery Request\n\nEmail: ${recoveryEmail.trim()}\nName: ${userProfile?.name || 'Unknown'}\n\nThis user is requesting password recovery. Please assist them.`,
        });
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
          alt="RKR Premium"
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
          RKR Premium Store
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
    </div>
  );
};

export default AuthPage;
