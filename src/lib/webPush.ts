// VAPID Web Push helper (replaces Firebase Messaging)
import { supabase } from '@/integrations/supabase/client';

// Public VAPID key (safe to expose)
export const VAPID_PUBLIC_KEY =
  'BIYBmye4KnM4FCClZKwscI5WaSjXpqco3JA4Dqg2vjteZRYyBDd04uUXL5MBsk5-6E1LnqWnBsuIqdQasQ7_oGk';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  } catch (e) {
    console.error('SW register failed', e);
    return null;
  }
}

export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await registerPushServiceWorker();
  if (!reg) return false;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    });
  }

  const json = subscription.toJSON();
  const p256dh = bufToBase64(subscription.getKey('p256dh'));
  const auth = bufToBase64(subscription.getKey('auth'));

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('Save subscription failed', error);
    return false;
  }

  await supabase.from('profiles').update({ notifications_enabled: true }).eq('id', userId);
  return true;
}

export async function unsubscribeUserFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  await supabase.from('profiles').update({ notifications_enabled: false }).eq('id', userId);
}
