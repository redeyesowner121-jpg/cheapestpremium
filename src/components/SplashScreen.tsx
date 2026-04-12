import React, { useEffect, useState } from 'react';
import appLogoFallback from '@/assets/app-logo.jpg';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const { settings, loading } = useAppSettingsContext();
  const appLogo = settings.app_logo || appLogoFallback;

  // Minimum display time of 800ms for branding
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Exit once min time elapsed AND settings loaded
  useEffect(() => {
    if (minTimeElapsed && !loading) {
      setIsExiting(true);
      const exitTimer = setTimeout(onComplete, 300);
      return () => clearTimeout(exitTimer);
    }
  }, [minTimeElapsed, loading, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-primary/20">
        <img
          src={appLogo}
          alt="App Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <h1 className="mt-6 text-2xl font-bold text-foreground">
        {settings.app_name || 'Loading...'}
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        {settings.app_tagline}
      </p>

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
