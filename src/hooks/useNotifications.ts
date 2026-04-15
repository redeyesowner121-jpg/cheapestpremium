import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check current permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Initialize Firebase Messaging
  useEffect(() => {
    if (!user || isInitialized) return;

    const initFCM = async () => {
      try {
        const { initializeMessaging, onPushMessage } = await import('@/lib/firebase');
        await initializeMessaging();
        
        // Register service worker for background notifications
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('Service Worker registered:', registration);
          } catch (err) {
            console.log('Service Worker registration failed:', err);
          }
        }

        // Listen for foreground messages
        onPushMessage((payload) => {
          console.log('Foreground push message:', payload);
          
          // Show toast notification
          toast.info(payload.notification?.title || 'New Notification', {
            description: payload.notification?.body,
            duration: 8000
          });
        });

        setIsInitialized(true);
      } catch (error) {
        console.log('FCM initialization error:', error);
      }
    };

    initFCM();
  }, [user, isInitialized]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      // Request browser notification permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Request FCM token for push notifications
        const { requestPushNotificationPermission } = await import('@/lib/firebase');
        const token = await requestPushNotificationPermission();
        if (token) {
          setFcmToken(token);
          
          // Save FCM token to user profile
          if (user) {
            await supabase
              .from('profiles')
              .update({ fcm_token: token, notifications_enabled: true })
              .eq('id', user.id);
          }
          console.log('Push notifications enabled with token');
        }
        
        toast.success('Notifications enabled!');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    if (permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'rkr-notification-' + Date.now(),
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
    return null;
  }, [permission]);

  // Subscribe to realtime notifications from database
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          // Show browser notification
          if (permission === 'granted') {
            showNotification(
              payload.new.title,
              payload.new.message
            );
          }
          
          // Also show toast for in-app notification
          toast.info(payload.new.title, {
            description: payload.new.message,
            duration: 6000
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, permission, showNotification]);

  return {
    permission,
    fcmToken,
    requestPermission,
    showNotification
  };
};

// Helper function to send notification to a user
export const sendNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: string = 'info'
) => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type
  });

  if (error) {
    console.error('Error sending notification:', error);
    return false;
  }
  return true;
};
