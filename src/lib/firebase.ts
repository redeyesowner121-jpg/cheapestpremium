import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add scopes for user info
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
