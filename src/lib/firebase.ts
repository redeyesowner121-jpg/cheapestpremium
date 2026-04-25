import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

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

// Firebase is now only used for phone OTP auth.
// Push notifications have moved to VAPID-based Web Push (see src/lib/webPush.ts).
const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
    callback: () => {},
  });
};

export const sendPhoneOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  return signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier);
};
