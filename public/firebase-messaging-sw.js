// Firebase Cloud Messaging Service Worker
// This is required for receiving push notifications when the app is in the background

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyARhUjJ45a6XKuD54P2IxWGf30cowwL2Ac",
  authDomain: "cheap-premium-14086.firebaseapp.com",
  projectId: "cheap-premium-14086",
  storageBucket: "cheap-premium-14086.firebasestorage.app",
  messagingSenderId: "896807949890",
  appId: "1:896807949890:web:f0968ca056c5c9c2f27fdb"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'notification-' + Date.now(),
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  event.notification.close();

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
