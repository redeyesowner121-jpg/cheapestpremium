import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Wallet, Clock, User } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/products', icon: ShoppingBag, label: 'Shop' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
  { path: '/orders', icon: Clock, label: 'Orders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
              {/* Active Background */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 rounded-2xl shadow-lg shadow-primary/30" />
              )}
              
              {/* Icon Container */}
              <div className={`relative z-10 ${isActive ? '-translate-y-0.5' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : ''}`} />
              </div>
              
              {/* Label */}
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
      
      {/* Safe area for iPhone */}
      <div className="h-safe-area-inset-bottom bg-background/80" />
    </nav>
  );
};

export default BottomNav;
