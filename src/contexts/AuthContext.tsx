import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { ref, set, get, update, onValue } from 'firebase/database';
import { auth, database, googleProvider } from '@/lib/firebase';
import { toast } from 'sonner';

interface UserData {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  photoURL?: string;
  walletBalance: number;
  totalDeposit: number;
  totalOrders: number;
  hasBlueCheck: boolean;
  referralCode: string;
  referredBy?: string;
  isAdmin: boolean;
  isTempAdmin: boolean;
  tempAdminExpiry?: number;
  createdAt: number;
  lastLogin: number;
  lastDailyBonus?: string;
  notificationsEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string, referralCode?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const generateReferralCode = () => {
  return 'RKR' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const createUserData = async (user: User, name: string, phone?: string, referralCode?: string): Promise<UserData> => {
    const newUserData: UserData = {
      uid: user.uid,
      email: user.email || '',
      name: name,
      phone: phone,
      photoURL: user.photoURL || '',
      walletBalance: 0,
      totalDeposit: 0,
      totalOrders: 0,
      hasBlueCheck: false,
      referralCode: generateReferralCode(),
      referredBy: referralCode,
      isAdmin: user.email === 'admin@2007' || user.email === 'admin@rkr.com',
      isTempAdmin: false,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      notificationsEnabled: false,
    };

    await set(ref(database, `users/${user.uid}`), newUserData);
    
    // If referral code provided, credit the referrer
    if (referralCode) {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = snapshot.val();
        for (const uid in users) {
          if (users[uid].referralCode === referralCode) {
            await update(ref(database, `users/${uid}`), {
              walletBalance: (users[uid].walletBalance || 0) + 10
            });
            break;
          }
        }
      }
    }

    return newUserData;
  };

  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    const snapshot = await get(ref(database, `users/${uid}`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        const data = await fetchUserData(user.uid);
        if (data) {
          // Check if temp admin expired
          if (data.isTempAdmin && data.tempAdminExpiry && data.tempAdminExpiry < Date.now()) {
            await update(ref(database, `users/${user.uid}`), {
              isTempAdmin: false,
              tempAdminExpiry: null
            });
            data.isTempAdmin = false;
          }
          
          // Update last login
          await update(ref(database, `users/${user.uid}`), {
            lastLogin: Date.now()
          });
          
          setUserData(data);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen for real-time updates to user data
  useEffect(() => {
    if (!user) return;

    const userRef = ref(database, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const data = await fetchUserData(result.user.uid);
      if (data) {
        await update(ref(database, `users/${result.user.uid}`), {
          lastLogin: Date.now()
        });
      }
      toast.success('Welcome back!');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, phone?: string, referralCode?: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await createUserData(result.user, name, phone, referralCode);
      toast.success('Account created successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      let data = await fetchUserData(result.user.uid);
      
      if (!data) {
        data = await createUserData(result.user, result.user.displayName || 'User');
      } else {
        await update(ref(database, `users/${result.user.uid}`), {
          lastLogin: Date.now()
        });
      }
      
      toast.success('Welcome!');
    } catch (error: any) {
      toast.error(error.message || 'Google login failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error(error.message || 'Logout failed');
      throw error;
    }
  };

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user) return;
    
    try {
      await update(ref(database, `users/${user.uid}`), data);
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    const data = await fetchUserData(user.uid);
    if (data) {
      setUserData(data);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      updateUserData,
      refreshUserData,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
