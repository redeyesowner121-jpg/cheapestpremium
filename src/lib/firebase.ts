import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAUeAgooPulNk3r3s7mshgy94fnRIm7vQw",
  authDomain: "cheap-premium-14086.firebaseapp.com",
  databaseURL: "https://cheap-premium-14086-default-rtdb.firebaseio.com",
  projectId: "cheap-premium-14086",
  storageBucket: "cheap-premium-14086.firebasestorage.app",
  messagingSenderId: "896807949890",
  appId: "1:896807949890:web:98e4f78e2cba53a2f27fdb",
  measurementId: "G-2RTK8KRK4L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add scopes for user info
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

// Phone auth helpers
export const setupRecaptcha = (containerId: string) => {
  const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    }
  });
  return recaptchaVerifier;
};

export const sendPhoneOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  return signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier);
};

// Firebase Cloud Messaging for Push Notifications
let messaging: ReturnType<typeof getMessaging> | null = null;

export const initializeMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
    console.log('Firebase Messaging not supported in this browser');
    return null;
  } catch (error) {
    console.log('Error initializing Firebase Messaging:', error);
    return null;
  }
};

export const requestPushNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      await initializeMessaging();
    }
    
    if (!messaging) {
      console.log('Messaging not available');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token - Using VAPID key from Firebase console
    // Note: For production, you'll need to generate a VAPID key from Firebase Console
    const token = await getToken(messaging, {
      vapidKey: 'BLBx-hF5THyv9f0wH4A8zCl7xjMeS0WsFfB_mHH1K6Ga7qR6EsXwLwXZbLzTBEK_GS-kVJv_3qLf8xWvS3mYqXE'
    });

    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

export const onPushMessage = (callback: (payload: any) => void) => {
  if (!messaging) {
    console.log('Messaging not initialized');
    return;
  }
  
  onMessage(messaging, (payload) => {
    console.log('Push message received:', payload);
    callback(payload);
  });
};

export { messaging };
