import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Phone, Eye, EyeOff, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmationResult } from 'firebase/auth';
import appLogo from '@/assets/app-logo.jpg';

type AuthMode = 'email' | 'phone';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, sendPhoneOTP, verifyPhoneOTP, user } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    otp: '',
    referralCode: '',
  });

  React.useEffect(() => {
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

  const handleSendOTP = async () => {
    if (!formData.phone) return;
    setLoading(true);
    
    try {
      const phoneWithCode = formData.phone.startsWith('+') ? formData.phone : `+91${formData.phone}`;
      const result = await sendPhoneOTP(phoneWithCode, 'recaptcha-container');
      if (result) {
        setConfirmationResult(result);
        setOtpSent(true);
      }
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    
    try {
      await verifyPhoneOTP(confirmationResult, formData.otp, formData.name || 'User');
      navigate('/');
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>
      
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
          {isLogin ? 'Welcome back!' : 'Create your account'}
        </motion.p>
      </div>

      {/* Form Card */}
      <motion.div
        className="flex-1 -mt-12 bg-card rounded-t-3xl px-6 py-8"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Auth Mode Toggle */}
        <div className="flex rounded-xl bg-muted p-1 mb-6">
          <button
            type="button"
            onClick={() => { setAuthMode('email'); setOtpSent(false); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              authMode === 'email' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Email
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('phone'); setOtpSent(false); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              authMode === 'phone' 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground'
            }`}
          >
            <Phone className="w-4 h-4 inline mr-2" />
            Phone
          </button>
        </div>

        {authMode === 'email' ? (
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
                    placeholder="Phone Number *"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-12 h-12 rounded-xl bg-muted border-0"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1 ml-1">Required for order delivery</p>
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

            <Button
              type="submit"
              className="w-full h-12 btn-gradient rounded-xl font-semibold"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            {!otpSent ? (
              <>
                {!isLogin && (
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
                )}

                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Phone Number (e.g., 9876543210)"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-12 h-12 rounded-xl bg-muted border-0"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send an OTP to +91{formData.phone || 'XXXXXXXXXX'}
                </p>

                <Button
                  type="button"
                  onClick={handleSendOTP}
                  className="w-full h-12 btn-gradient rounded-xl font-semibold"
                  disabled={loading || !formData.phone}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    OTP sent to +91{formData.phone}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-primary text-sm font-medium mt-1"
                  >
                    Change number
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={formData.otp}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                    className="pl-12 h-12 rounded-xl bg-muted border-0 text-center text-xl tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 btn-gradient rounded-xl font-semibold"
                  disabled={loading || formData.otp.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full"
                >
                  Resend OTP
                </Button>
              </>
            )}
          </form>
        )}

        <div className="my-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-12 rounded-xl font-medium"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setOtpSent(false); }}
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
      </motion.div>
    </div>
  );
};

export default AuthPage;
