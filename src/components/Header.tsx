import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, MessageCircle, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import BlueTick from './BlueTick';
import appLogo from '@/assets/app-logo.jpg';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, isTempAdmin } = useAuth();

  const showAdminButton = isAdmin || isTempAdmin;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <motion.img
            src={appLogo}
            alt="RKR Premium"
            className="w-10 h-10 rounded-xl object-cover shadow-card"
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
          />
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-1">
              RKR Premium
              {profile?.has_blue_check && <BlueTick size="sm" />}
            </h1>
            {profile && (
              <p className="text-xs text-muted-foreground">
                Balance: ₹{profile.wallet_balance?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showAdminButton && (
            <motion.button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-accent/10 text-accent"
              whileTap={{ scale: 0.9 }}
            >
              <Shield className="w-5 h-5" />
            </motion.button>
          )}
          
          <motion.button
            onClick={() => navigate('/notifications')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors relative"
            whileTap={{ scale: 0.9 }}
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute -top-1 -right-1 w-4 h-4 gradient-accent rounded-full flex items-center justify-center text-[10px] text-accent-foreground font-bold">
              3
            </span>
          </motion.button>

          <motion.button
            onClick={() => navigate('/chat')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};

export default Header;
