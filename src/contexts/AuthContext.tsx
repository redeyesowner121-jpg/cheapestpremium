import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { firebaseAuth, googleProvider, setupRecaptcha, sendPhoneOTP } from '@/lib/firebase';
import { signInWithPopup, ConfirmationResult } from 'firebase/auth';
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
  has_blue_check: boolean;
  referral_code: string;
  referred_by?: string;
  notifications_enabled: boolean;
  last_daily_bonus?: string;
  created_at: string;
  rank_balance: number;
  is_reseller: boolean;
  last_rank_decay?: string;
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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setProfile(data as UserProfile);
    }
    return data;
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

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        checkAdminRole(session.user.id);
      }
      
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
            fetchProfile(session.user.id);
            checkAdminRole(session.user.id);
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

    // Update profile with additional data if created
    if (data.user) {
      await supabase.from('profiles').update({
        name,
        phone,
        referred_by: referralCode
      }).eq('id', data.user.id);

      // Note: Referral bonus is now handled on first deposit in razorpay-verify
      // This prevents double bonus - users must deposit to trigger referral reward
    }
    
    toast.success('Account created successfully!');
  };

  const loginWithTelegram = async () => {
    try {
      // Redirect to Telegram bot for authentication
      const botUsername = 'RKR_Premium_bot';
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
