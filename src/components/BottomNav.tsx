import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, Clock, User } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount } = useCart();

  const navItems = [
    { path: '/', icon: Home, label: 'Home', badge: 0 },
    { path: '/products', icon: ShoppingBag, label: 'Shop', badge: 0 },
    { path: '/cart', icon: ShoppingCart, label: 'Cart', badge: cartCount },
    { path: '/orders', icon: Clock, label: 'Orders', badge: 0 },
    { path: '/profile', icon: User, label: 'Profile', badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-lg">
      <div className="flex items-center justify-around py-1.5 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all min-w-[60px] active:scale-95 ${
                isActive 
                  ? 'text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-2xl shadow-lg shadow-primary/30" />
              )}
              
              <div className={`relative z-10 ${isActive ? '-translate-y-0.5' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : ''}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[9px] text-destructive-foreground font-bold">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              
              <span 
                className={`text-[10px] mt-0.5 font-medium relative z-10 ${
                  isActive ? 'text-primary-foreground' : ''
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      <div className="h-safe-area-inset-bottom bg-background/80" />
    </nav>
  );
};

export default BottomNav;
