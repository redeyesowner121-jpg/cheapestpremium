import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyARhUjJ45a6XKuD54P2IxWGf30cowwL2Ac",
  authDomain: "cheap-premium-14086.firebaseapp.com",
  databaseURL: "https://cheap-premium-14086-default-rtdb.firebaseio.com",
  projectId: "cheap-premium-14086",
  storageBucket: "cheap-premium-14086.firebasestorage.app",
  messagingSenderId: "896807949890",
  appId: "1:896807949890:web:f0968ca056c5c9c2f27fdb",
  measurementId: "G-3WN23EXK6Y"
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
