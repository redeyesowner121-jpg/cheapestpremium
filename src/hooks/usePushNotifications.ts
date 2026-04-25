import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isPushSupported, subscribeUserToPush, registerPushServiceWorker } from '@/lib/webPush';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isPushSupported());
  }, []);

  // Auto-register service worker once supported (for receiving foreground messages)
  useEffect(() => {
    if (!isSupported) return;
    registerPushServiceWorker();
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications not supported in this browser');
      return null;
    }
    if (!user) {
      toast.error('Please log in first');
      return null;
    }
    try {
      const ok = await subscribeUserToPush(user.id);
      if (ok) {
        toast.success('Push notifications enabled! 🔔');
        return true;
      }
      toast.error('Could not enable push notifications');
      return null;
    } catch (e) {
      console.error('Push subscribe error', e);
      toast.error('Could not enable push notifications');
      return null;
    }
  }, [user, isSupported]);

  return { isSupported, requestPermission, fcmToken: null };
};
