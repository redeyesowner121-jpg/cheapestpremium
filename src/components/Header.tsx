import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, Shield, Search, LogIn } from 'lucide-react';
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
          <img
            src={appLogo}
            alt={settings.app_name}
            className="w-10 h-10 rounded-xl object-cover shadow-card cursor-pointer active:scale-95 transition-transform"
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
          <button
            onClick={() => navigate('/products')}
            className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors active:scale-90"
          >
            <Search className="w-5 h-5 text-primary" />
          </button>

          {!user && (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}

          {showAdminButton && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-accent/10 text-accent active:scale-90 transition-transform"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors relative active:scale-90"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 gradient-accent rounded-full flex items-center justify-center text-[10px] text-accent-foreground font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors active:scale-90"
          >
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;
