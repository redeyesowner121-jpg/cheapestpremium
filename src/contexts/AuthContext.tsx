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
  loginWithGoogle: () => Promise<void>;
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        checkAdminRole(session.user.id);
      }
      
      setLoading(false);
    });

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

      // Handle referral bonus
      if (referralCode) {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id, wallet_balance')
          .eq('referral_code', referralCode)
          .maybeSingle();
        
        if (referrer) {
          await supabase.from('profiles').update({
            wallet_balance: (referrer.wallet_balance || 0) + 10
          }).eq('id', referrer.id);

          await supabase.from('transactions').insert({
            user_id: referrer.id,
            type: 'referral',
            amount: 10,
            status: 'completed',
            description: 'Referral bonus'
          });
        }
      }
    }
    
    toast.success('Account created successfully!');
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const firebaseUser = result.user;
      
      // Sign in to Supabase with the Firebase user's email
      // First try to sign in, if fails, create account
      const email = firebaseUser.email;
      const name = firebaseUser.displayName || email?.split('@')[0] || 'User';
      const avatarUrl = firebaseUser.photoURL;
      
      if (!email) {
        toast.error('Could not get email from Google account');
        return;
      }

      // Generate a secure password from Firebase UID
      const password = `firebase_${firebaseUser.uid}_secure`;
      
      // Try to sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        // If sign in fails, create new account
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, avatar_url: avatarUrl }
          }
        });
        
        if (signUpError) {
          toast.error(signUpError.message);
          throw signUpError;
        }

        // Update profile with Google data
        if (data.user) {
          await supabase.from('profiles').update({
            name,
            avatar_url: avatarUrl
          }).eq('id', data.user.id);
        }
      }
      
      toast.success('Welcome!');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google login failed');
      }
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
      loginWithGoogle,
      sendPhoneOTP: handleSendPhoneOTP,
      verifyPhoneOTP,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
