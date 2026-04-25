import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import appLogoFallback from '@/assets/app-logo.jpg';
import EmailAuthForm from './auth/EmailAuthForm';
import ForgotPasswordForm from './auth/ForgotPasswordForm';
import TelegramLoginDialog from './auth/TelegramLoginDialog';
import SocialAuthButtons from './auth/SocialAuthButtons';
import { verifyTelegramCode, sendPasswordRecoveryRequest } from './auth/auth-helpers';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, user } = useAuth();
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
    name: '', email: '', password: '', phone: '', referralCode: '',
  });

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setFormData(prev => ({ ...prev, referralCode: refCode.toUpperCase() }));
      setIsLogin(false);
    }
    const tgCode = searchParams.get('telegramLogin');
    if (tgCode) { setTelegramCode(tgCode); setShowTelegramCodeModal(true); }
    if (location.pathname === '/auth/telegram') setShowTelegramCodeModal(true);
  }, [searchParams, location.pathname]);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate('/');
      } else {
        await register(formData.email, formData.password, formData.name, formData.phone, formData.referralCode);
      }
    } catch { /* handled in context */ } finally {
      setLoading(false);
    }
  };

  const handleTelegramCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramCode.trim()) { toast.error('Please enter the login code from Telegram'); return; }
    setVerifyingCode(true);
    try {
      await verifyTelegramCode(telegramCode);
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
    if (!recoveryEmail.trim()) { toast.error('Please enter your email address'); return; }
    setRecoverySending(true);
    try {
      const ok = await sendPasswordRecoveryRequest(recoveryEmail);
      if (ok) {
        toast.success('Recovery request sent to admin! They will contact you soon.');
        setShowForgotPassword(false);
        setRecoveryEmail('');
      }
    } catch {
      toast.error('Failed to send recovery request');
    } finally {
      setRecoverySending(false);
    }
  };

  const headerSubtext = showForgotPassword ? 'Recover your password' : isLogin ? 'Welcome back!' : 'Create your account';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="gradient-primary pt-12 pb-20 px-6 text-center">
        <motion.img src={appLogo} alt={settings.app_name}
          className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }} />
        <motion.h1 className="text-2xl font-bold text-primary-foreground"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {settings.app_name}
        </motion.h1>
        <motion.p className="text-primary-foreground/80 text-sm mt-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {headerSubtext}
        </motion.p>
      </div>

      <motion.div className="flex-1 -mt-12 bg-card rounded-t-3xl px-6 py-8"
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}>
        {showForgotPassword ? (
          <ForgotPasswordForm
            recoveryEmail={recoveryEmail}
            setRecoveryEmail={setRecoveryEmail}
            recoverySending={recoverySending}
            onBack={() => setShowForgotPassword(false)}
            onSubmit={handlePasswordRecovery}
          />
        ) : (
          <>
            <EmailAuthForm
              isLogin={isLogin}
              formData={formData}
              setFormData={setFormData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loading={loading}
              onSubmit={handleEmailSubmit}
              onForgotPassword={() => setShowForgotPassword(true)}
            />

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <SocialAuthButtons
              loading={loading}
              setLoading={setLoading}
              onTelegram={() => setShowTelegramCodeModal(true)}
            />

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold">
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

      <TelegramLoginDialog
        open={showTelegramCodeModal}
        onOpenChange={setShowTelegramCodeModal}
        telegramCode={telegramCode}
        setTelegramCode={setTelegramCode}
        verifyingCode={verifyingCode}
        onSubmit={handleTelegramCodeSubmit}
      />
    </div>
  );
};

export default AuthPage;
