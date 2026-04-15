import React, { useEffect, useState } from 'react';
import { Download, MessageCircle, Send, ExternalLink, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SubdomainConfig {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  redirectUrl: string;
  buttonText: string;
  gradient: string;
  iconBg: string;
  autoRedirectSeconds: number;
}

const SUBDOMAIN_MAP: Record<string, SubdomainConfig> = {
  app: {
    title: 'Download Our App',
    subtitle: 'Get the best premium subscriptions at the cheapest prices — right from your phone.',
    icon: <Download className="w-8 h-8" />,
    redirectUrl: '#', // Replace with actual APK link
    buttonText: 'Download APK',
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    iconBg: 'bg-blue-500/20 text-blue-400',
    autoRedirectSeconds: 5,
  },
  wa: {
    title: 'Join Us on WhatsApp',
    subtitle: 'Get instant updates, exclusive deals, and direct support on WhatsApp.',
    icon: <MessageCircle className="w-8 h-8" />,
    redirectUrl: 'https://wa.me/919876543210', // Replace with actual number
    buttonText: 'Open WhatsApp',
    gradient: 'from-green-600 via-emerald-600 to-teal-600',
    iconBg: 'bg-green-500/20 text-green-400',
    autoRedirectSeconds: 3,
  },
  t: {
    title: 'Join Our Telegram',
    subtitle: 'Stay connected with our community for the latest deals and announcements.',
    icon: <Send className="w-8 h-8" />,
    redirectUrl: 'https://t.me/yourchannel', // Replace with actual channel
    buttonText: 'Open Telegram',
    gradient: 'from-sky-500 via-blue-500 to-cyan-500',
    iconBg: 'bg-sky-500/20 text-sky-400',
    autoRedirectSeconds: 3,
  },
};

/**
 * Detects subdomain from hostname and returns config, or null if main domain.
 */
export function getSubdomainConfig(): SubdomainConfig | null {
  const hostname = window.location.hostname;
  
  // Skip in development / preview
  if (
    hostname === 'localhost' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com')
  ) {
    return null;
  }

  // Extract subdomain: "app.cheapest-premiums.in" → "app"
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (sub !== 'www' && SUBDOMAIN_MAP[sub]) {
      return SUBDOMAIN_MAP[sub];
    }
  }

  return null;
}

const SubdomainLanding: React.FC<{ config: SubdomainConfig }> = ({ config }) => {
  const [countdown, setCountdown] = useState(config.autoRedirectSeconds);

  // Track visit
  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const sub = parts.length >= 3 ? parts[0].toLowerCase() : 'unknown';
    supabase.from('site_visits').insert({
      page: window.location.pathname,
      subdomain: sub,
      referrer: document.referrer || null,
    }).then(() => {});
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = config.redirectUrl;
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, config.redirectUrl]);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.gradient} flex items-center justify-center p-4`}>
      {/* Decorative orbs */}
      <div className="fixed top-20 -left-20 w-60 h-60 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full text-center space-y-8">
        {/* Logo / Brand */}
        <div className="space-y-2">
          <h2 className="text-white/70 text-sm font-semibold tracking-widest uppercase">
            Cheapest Premiums
          </h2>
        </div>

        {/* Icon */}
        <div className={`w-20 h-20 mx-auto rounded-3xl ${config.iconBg} flex items-center justify-center backdrop-blur-sm border border-white/10`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {config.title}
          </h1>
          <p className="text-white/70 text-base leading-relaxed px-4">
            {config.subtitle}
          </p>
        </div>

        {/* CTA Button */}
        <a
          href={config.redirectUrl}
          className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg"
        >
          {config.buttonText}
          <ArrowRight className="w-5 h-5" />
        </a>

        {/* Countdown */}
        <p className="text-white/50 text-sm">
          Redirecting in <span className="text-white font-bold">{countdown}s</span>...
        </p>

        {/* Back to main site */}
        <a
          href="https://cheapest-premiums.in"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Visit main website
        </a>
      </div>
    </div>
  );
};

export default SubdomainLanding;
