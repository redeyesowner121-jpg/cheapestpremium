import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, RefreshCw, Users, MessageCircle, Settings, Zap, CheckCircle, XCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BotStats {
  webhookSet: boolean;
  webhookUrl: string;
}

const AdminTelegramBot: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);

  const checkWebhook = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-set-webhook', {
        method: 'POST',
      });
      if (data?.success) {
        setBotStats({
          webhookSet: true,
          webhookUrl: data.webhook_url || '',
        });
        toast.success('Webhook is active!');
      } else {
        setBotStats({ webhookSet: false, webhookUrl: '' });
        toast.error('Webhook check failed');
      }
    } catch (err) {
      toast.error('Failed to check webhook');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Initial check
    checkWebhook();
  }, []);

  return (
    <div className="space-y-4">
      {/* Bot Status Card */}
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Bot className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Telegram Bot</h3>
            <p className="text-sm text-muted-foreground">Manage your selling bot</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            botStats?.webhookSet
              ? 'bg-green-500/20 text-green-600'
              : 'bg-red-500/20 text-red-500'
          }`}>
            {botStats?.webhookSet ? (
              <><CheckCircle className="w-3.5 h-3.5" /> Active</>
            ) : (
              <><XCircle className="w-3.5 h-3.5" /> Inactive</>
            )}
          </div>
        </div>

        {botStats?.webhookUrl && (
          <div className="bg-background/50 rounded-xl p-3 mb-3">
            <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
            <p className="text-xs font-mono text-foreground break-all">{botStats.webhookUrl}</p>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={checkWebhook}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking...' : 'Refresh / Re-activate Webhook'}
        </Button>
      </div>

      {/* Bot Features */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Bot Features
        </h4>
        <div className="space-y-3">
          {[
            { icon: '🛍️', label: 'View Products', desc: 'Shows all products as clickable buttons (2 per row)' },
            { icon: '📂', label: 'Category Browse', desc: 'Products organized by category' },
            { icon: '🛒', label: 'Buy Now', desc: 'Shows payment info with UPI & Binance details' },
            { icon: '🎁', label: 'Refer & Earn', desc: 'Referral program information' },
            { icon: '💰', label: 'My Wallet', desc: 'Link to web wallet' },
            { icon: '🔥', label: 'Get Offers', desc: 'Flash sales & coupon codes' },
            { icon: '📞', label: 'Support', desc: 'WhatsApp contact support' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-xl">
              <span className="text-xl">{feature.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{feature.label}</p>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Payment Settings Info */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          Payment Info (shown in bot)
        </h4>
        <p className="text-sm text-muted-foreground mb-3">
          The bot uses your admin settings for payment details. Update them in the <b>Administration → Settings</b> section:
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
            <span className="text-muted-foreground">UPI/Payment Link</span>
            <span className="font-mono text-xs text-foreground">payment_link setting</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
            <span className="text-muted-foreground">Binance ID</span>
            <span className="font-mono text-xs text-foreground">binance_id setting</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
            <span className="text-muted-foreground">WhatsApp Contact</span>
            <span className="font-mono text-xs text-foreground">contact_whatsapp setting</span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
            <span className="text-muted-foreground">Currency Symbol</span>
            <span className="font-mono text-xs text-foreground">currency_symbol setting</span>
          </div>
        </div>
      </div>

      {/* Bot Commands Reference */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Bot Commands
        </h4>
        <div className="space-y-2">
          {[
            { cmd: '/start', desc: 'Welcome message with main menu' },
            { cmd: '/products', desc: 'View all products' },
            { cmd: '/help', desc: 'Show help commands' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-xl">
              <code className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-lg font-bold">{c.cmd}</code>
              <span className="text-sm text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Quick Links
        </h4>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => window.open('https://t.me/BotFather', '_blank')}
          >
            🤖 BotFather
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => window.open('https://core.telegram.org/bots/api', '_blank')}
          >
            📖 Bot API Docs
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminTelegramBot;
