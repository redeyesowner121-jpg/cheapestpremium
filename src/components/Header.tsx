import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, MessageCircle, Shield, Search, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import BlueTick from './BlueTick';
import appLogo from '@/assets/app-logo.jpg';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettings();

  const showAdminButton = isAdmin || isTempAdmin;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <motion.img
            src={appLogo}
            alt={settings.app_name}
            className="w-10 h-10 rounded-xl object-cover shadow-card"
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
          />
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-1">
              {settings.app_name}
              {profile?.has_blue_check && <BlueTick size="sm" />}
            </h1>
            {profile && (
              <p className="text-xs text-muted-foreground">
                Balance: {settings.currency_symbol}{profile.wallet_balance?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Login/Profile Button */}
          <motion.button
            onClick={() => navigate('/products')}
            className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            <Search className="w-5 h-5 text-primary" />
          </motion.button>

          {!user && (
            <motion.button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              whileTap={{ scale: 0.95 }}
            >
              <LogIn className="w-4 h-4" />
              Login
            </motion.button>
          )}

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
