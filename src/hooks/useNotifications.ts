import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isPushSupported, registerPushServiceWorker, subscribeUserToPush } from '@/lib/webPush';

export const useNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
  }, []);

  // Register the push service worker once when user is signed in
  useEffect(() => {
    if (!user || isInitialized || !isPushSupported()) return;
    registerPushServiceWorker().then(() => setIsInitialized(true));
  }, [user, isInitialized]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;

      if (user) {
        const ok = await subscribeUserToPush(user.id);
        if (ok) toast.success('Notifications enabled! 🔔');
      }
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  }, [user]);

  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    if (permission !== 'granted') return null;
    const n = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'rkr-' + Date.now(),
    });
    n.onclick = () => { window.focus(); n.close(); };
    return n;
  }, [permission]);

  // Realtime in-app notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (permission === 'granted') showNotification(payload.new.title, payload.new.message);
          toast.info(payload.new.title, { description: payload.new.message, duration: 6000 });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, permission, showNotification]);

  return { permission, fcmToken: null, requestPermission, showNotification };
};

export const sendNotification = async (userId: string, title: string, message: string, type = 'info') => {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title, message, type });
  if (error) { console.error('Error sending notification:', error); return false; }
  return true;
};
