import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Shield, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import BlueTick from './BlueTick';
import appLogo from '@/assets/app-logo.jpg';

const Header: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettingsContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const walletBalance = Number(profile?.wallet_balance ?? 0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('header-notif-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const showAdminButton = isAdmin || isTempAdmin;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={appLogo}
              alt={settings.app_name}
              className="w-11 h-11 rounded-2xl object-cover shadow-colored-primary cursor-pointer active:scale-95 transition-transform ring-2 ring-primary/20"
              onClick={() => navigate('/')}
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 gradient-primary rounded-full border-2 border-background" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5 font-display">
              {settings.app_name}
              {profile?.has_blue_check && <BlueTick size="sm" />}
            </h1>
            {profile && (
              <p className="text-xs font-medium">
                <span className="text-muted-foreground">Balance: </span>
                <span className="text-gradient font-bold">{settings.currency_symbol}{walletBalance.toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!user && (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl btn-gradient text-primary-foreground text-sm font-semibold active:scale-95 transition-transform"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}

          {showAdminButton && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2.5 rounded-2xl gradient-warm text-accent-foreground active:scale-90 transition-transform shadow-colored-accent"
            >
              <Shield className="w-4.5 h-4.5" />
            </button>
          )}
          
          <button
            onClick={() => navigate('/notifications')}
            className="p-2.5 rounded-2xl bg-primary/8 hover:bg-primary/15 transition-all relative active:scale-90"
          >
            <Bell className="w-5 h-5 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 gradient-accent rounded-full flex items-center justify-center text-[10px] text-accent-foreground font-bold shadow-colored-accent animate-bounce-in">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="p-2.5 rounded-2xl bg-secondary/8 hover:bg-secondary/15 transition-all active:scale-90"
          >
            <MessageCircle className="w-5 h-5 text-secondary" />
          </button>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
