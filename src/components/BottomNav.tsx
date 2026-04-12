import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, Clock, User } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

const BottomNav: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount } = useCart();

  const navItems = useMemo(() => [
    { path: '/', icon: Home, label: 'Home', badge: 0 },
    { path: '/products', icon: ShoppingBag, label: 'Shop', badge: 0 },
    { path: '/cart', icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { path: '/orders', icon: Clock, label: 'Orders', badge: 0 },
    { path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ], [cartCount]);

  const handleNav = useCallback((path: string) => {
    if (location.pathname !== path) navigate(path);
  }, [navigate, location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-2xl border-t border-border/30 will-change-transform">
      <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 min-w-[56px] active:scale-90 ${
                isActive 
                  ? 'text-primary-foreground -translate-y-0.5' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 gradient-primary rounded-2xl shadow-colored-primary" />
              )}
              
              <div className="relative z-10">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-primary-foreground scale-110' : ''}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-3 w-5 h-5 gradient-accent rounded-full flex items-center justify-center text-[9px] text-accent-foreground font-bold shadow-colored-accent">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              
              <span className={`text-[10px] mt-0.5 font-semibold relative z-10 transition-all duration-200 ${isActive ? 'text-primary-foreground' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="h-safe-area-inset-bottom bg-background/85" />
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
