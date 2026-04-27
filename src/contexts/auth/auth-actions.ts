import type { ConfirmationResult } from 'firebase/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const loginWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    toast.error(error.message);
    throw error;
  }
  toast.success('Welcome back!');
};

export const registerWithEmail = async (
  email: string,
  password: string,
  name: string,
  phone?: string,
  referralCode?: string,
) => {
  const redirectUrl = `${window.location.origin}/`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: { name, phone, referred_by: referralCode },
    },
  });
  if (error) {
    toast.error(error.message);
    throw error;
  }
  if (data.user && !data.session) {
    toast.success('📧 Verification email sent! Please check your inbox and verify your email before logging in.', {
      duration: 8000,
    });
    return;
  }
  if (data.user) {
    await supabase.from('profiles').update({
      name,
      phone,
      referred_by: referralCode,
    }).eq('id', data.user.id);
  }
  toast.success('Account created successfully!');
};

export const loginViaTelegram = async () => {
  try {
    const botUsername = 'Air1_Premium_bot';
    const telegramBotUrl = `https://t.me/${botUsername}`;
    toast.info('Opening Telegram bot...', {
      description: 'You will be redirected to Telegram to complete login',
    });
    window.open(telegramBotUrl, '_blank');
    toast.info('Complete login in Telegram', {
      description: 'Use /start command in the bot to login and manage your account',
    });
  } catch (error: any) {
    toast.error(error.message || 'Failed to open Telegram bot');
    throw error;
  }
};

export const sendPhoneOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
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

export const verifyPhoneOtp = async (
  confirmationResult: ConfirmationResult,
  otp: string,
  name: string,
) => {
  try {
    const result = await confirmationResult.confirm(otp);
    const firebaseUser = result.user;
    const phone = firebaseUser.phoneNumber;
    const email = `${phone?.replace(/\+/g, '')}@phone.rkr.app`;
    const password = `firebase_phone_${firebaseUser.uid}_secure`;

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name, phone },
        },
      });
      if (signUpError) {
        toast.error(signUpError.message);
        throw signUpError;
      }
      if (data.user) {
        await supabase.from('profiles').update({ name, phone }).eq('id', data.user.id);
      }
    }
    toast.success('Welcome!');
  } catch (error: any) {
    toast.error(error.message || 'Invalid OTP');
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    console.log('Logout completed');
  }
  toast.success('Logged out successfully');
};
