import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { ConfirmationResult } from 'firebase/auth';
import {
  fetchUserProfile,
  fetchAdminRole,
  type UserProfile,
} from './auth/profile-utils';
import {
  loginWithEmail,
  registerWithEmail,
  loginViaTelegram,
  sendPhoneOtp,
  verifyPhoneOtp,
  logoutUser,
} from './auth/auth-actions';

export type { UserProfile } from './auth/profile-utils';

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

  const loadProfile = async (userId: string, userMeta?: Record<string, any>) => {
    const p = await fetchUserProfile(userId, userMeta);
    setProfile(p);
    return p;
  };

  const loadAdminRole = async (userId: string) => {
    const info = await fetchAdminRole(userId);
    setIsAdmin(info.isAdmin);
    setIsTempAdmin(info.isTempAdmin);
    setTempAdminExpiry(info.tempAdminExpiry);
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const timeout = setTimeout(() => {
      if (!initialSessionHandled) {
        console.warn('Auth session fetch timed out, clearing loading state');
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadProfile(session.user.id, session.user.user_metadata);
        loadAdminRole(session.user.id);
      }

      setLoading(false);
    }).catch((err) => {
      console.error('Failed to get session:', err);
      initialSessionHandled = true;
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION' && initialSessionHandled) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            loadProfile(session.user.id, session.user.user_metadata);
            loadAdminRole(session.user.id);
            if (event === 'SIGNED_IN') {
              (supabase.rpc('auto_merge_my_telegram_data') as unknown as Promise<any>)
                .then(({ data }: any) => {
                  if (data?.success) {
                    loadProfile(session.user.id, session.user.user_metadata);
                  }
                })
                .catch(() => {});
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

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
      await loadAdminRole(user.id);
    }
  };

  const logout = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsTempAdmin(false);
    await logoutUser();
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
      login: loginWithEmail,
      register: registerWithEmail,
      loginWithTelegram: loginViaTelegram,
      sendPhoneOTP: sendPhoneOtp,
      verifyPhoneOTP: verifyPhoneOtp,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
