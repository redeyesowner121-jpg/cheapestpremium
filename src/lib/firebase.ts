import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDWGrH9hRb6SFmwQO2cnyA710wLZ2bjHZI",
  authDomain: "rkr-cheap-premiums.firebaseapp.com",
  databaseURL: "https://rkr-cheap-premiums-default-rtdb.firebaseio.com",
  projectId: "rkr-cheap-premiums",
  storageBucket: "rkr-cheap-premiums.firebasestorage.app",
  messagingSenderId: "805501288008",
  appId: "1:805501288008:web:2f8ae26d555c82ec54e27d",
  measurementId: "G-BN5N7MCQBW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics only in browser
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
