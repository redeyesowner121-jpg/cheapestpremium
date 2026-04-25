import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function verifyTelegramCode(code: string) {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-login`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ code: code.trim() }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to verify code');
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw new Error('Failed to set session');
}

export async function sendPasswordRecoveryRequest(email: string) {
  const { data: adminRoles, error: adminError } = await supabase
    .from('user_roles').select('user_id').eq('role', 'admin');
  if (adminError || !adminRoles?.length) {
    toast.error('No admin found. Please try again later.');
    return false;
  }
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles').select('name').eq('email', email.trim()).maybeSingle();
  if (profileError && profileError.code !== 'PGRST116') throw profileError;
  for (const admin of adminRoles) {
    const { error: insertError } = await supabase.from('chat_messages').insert({
      user_id: admin.user_id,
      is_admin: false,
      message: `🔑 Password Recovery Request\n\nEmail: ${email.trim()}\nName: ${userProfile?.name || 'Unknown'}\n\nThis user is requesting password recovery. Please assist them.`,
    });
    if (insertError) console.error('Failed to notify admin:', insertError);
  }
  return true;
}
