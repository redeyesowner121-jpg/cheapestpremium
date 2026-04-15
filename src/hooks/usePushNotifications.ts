import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { user, profile } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);
    };
    checkSupport();
  }, []);

  // Initialize messaging when user logs in
  useEffect(() => {
    if (!user || !isSupported) return;

    const init = async () => {
      const { initializeMessaging, onPushMessage } = await import('@/lib/firebase');
      await initializeMessaging();
      
      // Listen for foreground messages
      onPushMessage((payload) => {
        console.log('Foreground message:', payload);
        
        toast.info(payload.notification?.title || 'New Notification', {
          description: payload.notification?.body
        });
        
        if (Notification.permission === 'granted') {
          new Notification(payload.notification?.title || 'New Notification', {
            body: payload.notification?.body,
            icon: '/favicon.ico'
          });
        }
      });
    };

    init();
  }, [user, isSupported]);

  // Request push notification permission and get token
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.log('Push notifications not supported');
      return null;
    }

    try {
      const { requestPushNotificationPermission } = await import('@/lib/firebase');
      const token = await requestPushNotificationPermission();
      
      if (token && user) {
        setFcmToken(token);
        
        // Save token to user profile
        await supabase
          .from('profiles')
          .update({ fcm_token: token, notifications_enabled: true })
          .eq('id', user.id);
        
        console.log('FCM Token saved for user:', user.id);
        toast.success('Push notifications enabled!');
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Error requesting push permission:', error);
      toast.error('Could not enable push notifications');
      return null;
    }
  }, [user, isSupported]);

  return {
    fcmToken,
    isSupported,
    requestPermission
  };
};
