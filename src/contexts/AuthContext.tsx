import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { ConfirmationResult } from 'firebase/auth';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  wallet_balance: number;
  total_deposit: number;
  total_orders: number;
  total_savings: number;
  has_blue_check: boolean;
  referral_code: string;
  referred_by?: string;
  notifications_enabled: boolean;
  last_daily_bonus?: string;
  created_at: string;
  rank_balance: number;
  is_reseller: boolean;
  last_rank_decay?: string;
  display_currency: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isTempAdmin: boolean;
  tempAdminExpiry?: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string, referralCode?: string) => Promise<void>;
  loginWithTelegram: () => Promise<void>;
  sendPhoneOTP: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult | null>;
  verifyPhoneOTP: (confirmationResult: ConfirmationResult, otp: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
};

const parseString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

const normalizeProfile = (data: any): UserProfile => ({
  id: parseString(data?.id),
  email: parseString(data?.email),
  name: parseString(data?.name, 'User'),
  phone: typeof data?.phone === 'string' ? data.phone : undefined,
  avatar_url: typeof data?.avatar_url === 'string' ? data.avatar_url : undefined,
  wallet_balance: parseNumber(data?.wallet_balance),
  total_deposit: parseNumber(data?.total_deposit),
  total_orders: parseNumber(data?.total_orders),
  total_savings: parseNumber(data?.total_savings),
  has_blue_check: parseBoolean(data?.has_blue_check),
  referral_code: parseString(data?.referral_code),
  referred_by: typeof data?.referred_by === 'string' ? data.referred_by : undefined,
  notifications_enabled: parseBoolean(data?.notifications_enabled, true),
  last_daily_bonus: typeof data?.last_daily_bonus === 'string' ? data.last_daily_bonus : undefined,
  created_at: parseString(data?.created_at),
  rank_balance: parseNumber(data?.rank_balance),
  is_reseller: parseBoolean(data?.is_reseller),
  last_rank_decay: typeof data?.last_rank_decay === 'string' ? data.last_rank_decay : undefined,
  display_currency: parseString(data?.display_currency, 'INR'),
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTempAdmin, setIsTempAdmin] = useState(false);
  const [tempAdminExpiry, setTempAdminExpiry] = useState<string | undefined>();

  const fetchProfile = async (userId: string, userMeta?: Record<string, any>) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error);
      setProfile(null);
      return null;
    }

    if (data) {
      const normalizedProfile = normalizeProfile(data);

      // Check if blue tick has expired using already-available metadata
      if (normalizedProfile.has_blue_check && userMeta) {
        const blueTickExpiry = userMeta.blue_tick_expiry;
        if (blueTickExpiry && new Date(blueTickExpiry) < new Date()) {
          await supabase.from('profiles').update({ has_blue_check: false }).eq('id', userId);
          normalizedProfile.has_blue_check = false;
        }
      }

      setProfile(normalizedProfile);
      return normalizedProfile;
    }

    setProfile(null);
    return null;
  };

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role, temp_admin_expiry')
      .eq('user_id', userId);

    if (data) {
      const adminRole = data.find(r => r.role === 'admin');
      const tempAdminRole = data.find(r => r.role === 'temp_admin');
      
      setIsAdmin(!!adminRole);
      
      if (tempAdminRole) {
        const expiry = tempAdminRole.temp_admin_expiry;
        if (expiry && new Date(expiry) > new Date()) {
          setIsTempAdmin(true);
          setTempAdminExpiry(expiry);
        } else {
          setIsTempAdmin(false);
        }
      }
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    // Safety timeout: ensure loading clears even if Supabase hangs
    const timeout = setTimeout(() => {
      if (!initialSessionHandled) {
        console.warn('Auth session fetch timed out, clearing loading state');
        setLoading(false);
      }
    }, 5000);

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id, session.user.user_metadata);
        checkAdminRole(session.user.id);
      }
      
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to get session:', err);
      initialSessionHandled = true;
      clearTimeout(timeout);
      setLoading(false);
    });

    // Set up auth state listener - skip if initial session already handled same user
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Skip the INITIAL_SESSION event since getSession already handles it
        if (event === 'INITIAL_SESSION' && initialSessionHandled) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id, session.user.user_metadata);
            checkAdminRole(session.user.id);
            // Auto-merge any matching Telegram bot data (orders, wallet, etc.)
            // for this email — safe & idempotent.
            if (event === 'SIGNED_IN') {
              supabase.rpc('auto_merge_my_telegram_data').then(({ data }: any) => {
                if (data?.success) {
                  // Re-fetch profile so merged wallet/orders show up immediately
                  fetchProfile(session.user.id, session.user.user_metadata);
                }
              }).catch(() => {});
            }
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsTempAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success('Welcome back!');
  };

  const register = async (email: string, password: string, name: string, phone?: string, referralCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name, phone, referred_by: referralCode }
      }
    });
    
    if (error) {
      toast.error(error.message);
      throw error;
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      // Email confirmation required - user not auto-logged in
      toast.success('📧 Verification email sent! Please check your inbox and verify your email before logging in.', {
        duration: 8000,
      });
      return;
    }

    // Update profile with additional data if created
    if (data.user) {
      await supabase.from('profiles').update({
        name,
        phone,
        referred_by: referralCode
      }).eq('id', data.user.id);
    }
    
    toast.success('Account created successfully!');
  };

  const loginWithTelegram = async () => {
    try {
      // Redirect to Telegram bot for authentication
      const botUsername = 'Air1_Premium_bot';
      const telegramBotUrl = `https://t.me/${botUsername}`;

      toast.info('Opening Telegram bot...', {
        description: 'You will be redirected to Telegram to complete login'
      });

      // Open in new window or redirect
      window.open(telegramBotUrl, '_blank');

      toast.info('Complete login in Telegram', {
        description: 'Use /start command in the bot to login and manage your account'
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to open Telegram bot');
      throw error;
    }
  };

  const handleSendPhoneOTP = async (phoneNumber: string, recaptchaContainerId: string) => {
    try {
      const { setupRecaptcha, sendPhoneOTP } = await import('@/lib/firebase');
      const recaptchaVerifier = setupRecaptcha(recaptchaContainerId);
      const confirmationResult = await sendPhoneOTP(phoneNumber, recaptchaVerifier);
      toast.success('OTP sent to your phone');
      return confirmationResult;
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
      return null;
    }
  };

  const verifyPhoneOTP = async (confirmationResult: ConfirmationResult, otp: string, name: string) => {
    try {
      const result = await confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      const phone = firebaseUser.phoneNumber;
      const email = `${phone?.replace(/\+/g, '')}@phone.rkr.app`;
      const password = `firebase_phone_${firebaseUser.uid}_secure`;
      
      // Try to sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        // Create new account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, phone }
          }
        });
        
        if (signUpError) {
          toast.error(signUpError.message);
          throw signUpError;
        }

        // Update profile
        if (data.user) {
          await supabase.from('profiles').update({
            name,
            phone
          }).eq('id', data.user.id);
        }
      }
      
      toast.success('Welcome!');
    } catch (error: any) {
      toast.error(error.message || 'Invalid OTP');
      throw error;
    }
  };

  const logout = async () => {
    // Clear local state first
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsTempAdmin(false);
    
    try {
      // Sign out with global scope to clear all sessions including stored tokens
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      // Ignore session not found errors - user is already logged out
      console.log('Logout completed');
    }
    
    toast.success('Logged out successfully');
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await checkAdminRole(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isAdmin,
      isTempAdmin,
      tempAdminExpiry,
      login,
      register,
      loginWithTelegram,
      sendPhoneOTP: handleSendPhoneOTP,
      verifyPhoneOTP,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
