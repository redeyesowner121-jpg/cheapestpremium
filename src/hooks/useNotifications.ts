import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const showNotification = (title: string, body: string, icon?: string) => {
    if (permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'rkr-notification'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
    return null;
  };

  // Subscribe to realtime notifications
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
          if (permission === 'granted') {
            showNotification(
              payload.new.title,
              payload.new.message
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, permission]);

  return {
    permission,
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
