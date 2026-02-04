import React, { useEffect, useState } from 'react';
import appLogo from '@/assets/app-logo.jpg';
import { supabase } from '@/integrations/supabase/client';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [appName, setAppName] = useState('RKR Premium Store');

  useEffect(() => {
    // Load app name from settings
    const loadAppName = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_name')
        .maybeSingle();
      
      if (data?.value) {
        setAppName(data.value);
      }
    };
    
    loadAppName();
    
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 300);
    }, 1500);

    return () => clearTimeout(exitTimer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo */}
      <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-primary/20">
        <img
          src={appLogo}
          alt="App Logo"
          className="w-full h-full object-cover"
        />
      </div>

      {/* App Name */}
      <h1 className="mt-6 text-2xl font-bold text-foreground">
        {appName}
      </h1>

      {/* Tagline */}
      <p className="mt-2 text-sm text-muted-foreground">
        Premium Digital Products
      </p>

      {/* Simple Loading Indicator */}
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
