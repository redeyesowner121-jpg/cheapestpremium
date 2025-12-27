import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Notification sound URL (using a free notification sound)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface NewOrder {
  id: string;
  product_name: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  user_id: string;
}

export const useAdminOrderAlerts = (isAdmin: boolean, onNewOrder?: (order: NewOrder) => void) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastOrderTimeRef = useRef<string | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.7;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, []);

  const showOrderNotification = useCallback((order: NewOrder) => {
    // Play sound
    playNotificationSound();
    
    // Show toast notification
    toast.success(
      `🔔 New Order Received!`,
      {
        description: `${order.product_name} - ₹${order.total_price}`,
        duration: 10000,
        action: {
          label: 'View',
          onClick: () => {
            // Navigate to orders tab
            window.location.hash = '#orders';
          }
        }
      }
    );

    // Browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🔔 New Order!', {
        body: `${order.product_name} - ₹${order.total_price}`,
        icon: '/favicon.ico',
        tag: 'new-order-' + order.id,
        requireInteraction: true
      });
    }

    // Callback
    if (onNewOrder) {
      onNewOrder(order);
    }
  }, [playNotificationSound, onNewOrder]);

  // Subscribe to real-time order notifications
  useEffect(() => {
    if (!isAdmin) return;

    // Set initial reference time to now
    lastOrderTimeRef.current = new Date().toISOString();

    const channel = supabase
      .channel('admin-order-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload: any) => {
          const newOrder = payload.new as NewOrder;
          
          // Only alert for orders created after we started listening
          if (lastOrderTimeRef.current && newOrder.created_at > lastOrderTimeRef.current) {
            showOrderNotification(newOrder);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, showOrderNotification]);

  return {
    playNotificationSound
  };
};
