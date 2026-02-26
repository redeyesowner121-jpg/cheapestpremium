import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, Users, MessageCircle, Settings, Zap, CheckCircle, XCircle, Globe, Shield, Send, BarChart3, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BotStats {
  webhookSet: boolean;
  webhookUrl: string;
  totalUsers: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
}

const AdminTelegramBot: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [botStats, setBotStats] = useState<BotStats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Webhook check
      const { data } = await supabase.functions.invoke('telegram-set-webhook', { method: 'POST' });
      
      // Fetch bot user & order stats - use raw count queries
      const [usersRes, ordersRes, pendingRes, confirmedRes] = await Promise.all([
        supabase.from('telegram_bot_users' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      ]);

      setBotStats({
        webhookSet: data?.success || false,
        webhookUrl: data?.webhook_url || '',
        totalUsers: (usersRes as any).count || 0,
        totalOrders: (ordersRes as any).count || 0,
        pendingOrders: (pendingRes as any).count || 0,
        confirmedOrders: (confirmedRes as any).count || 0,
      });
      toast.success('Stats refreshed!');
    } catch {
      toast.error('Failed to fetch stats');
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

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
            <p className="text-sm text-muted-foreground">Super Admin Control System</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            botStats?.webhookSet ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-500'
          }`}>
            {botStats?.webhookSet ? <><CheckCircle className="w-3.5 h-3.5" /> Active</> : <><XCircle className="w-3.5 h-3.5" /> Inactive</>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: 'Bot Users', value: botStats?.totalUsers || 0, icon: Users, color: 'text-blue-500' },
            { label: 'Total Orders', value: botStats?.totalOrders || 0, icon: Package, color: 'text-purple-500' },
            { label: 'Pending', value: botStats?.pendingOrders || 0, icon: BarChart3, color: 'text-yellow-500' },
            { label: 'Confirmed', value: botStats?.confirmedOrders || 0, icon: CheckCircle, color: 'text-green-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {botStats?.webhookUrl && (
          <div className="bg-background/50 rounded-xl p-3 mb-3">
            <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
            <p className="text-xs font-mono text-foreground break-all">{botStats.webhookUrl}</p>
          </div>
        )}

        <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking...' : 'Refresh Stats & Webhook'}
        </Button>
      </div>

      {/* Admin Commands */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Admin Commands (Super Admin Only)
        </h4>
        <div className="space-y-2">
          {[
            { cmd: '/admin', desc: 'Open admin control panel', icon: '🔐' },
            { cmd: '/broadcast', desc: 'Send message to all users', icon: '📢' },
            { cmd: '/report', desc: 'Sales & analytics report', icon: '📊' },
            { cmd: '/add_product', desc: 'Add new product (multi-step)', icon: '➕' },
            { cmd: '/edit_price [name] [price]', desc: 'Update product price', icon: '✏️' },
            { cmd: '/out_stock [name]', desc: 'Mark product out of stock', icon: '❌' },
            { cmd: '/users', desc: 'View user stats & recent signups', icon: '👥' },
            { cmd: '/history [id]', desc: 'User order history', icon: '📜' },
            { cmd: '/ban [id]', desc: 'Ban a user', icon: '🚫' },
            { cmd: '/unban [id]', desc: 'Unban a user', icon: '✅' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-xl">
              <span className="text-lg">{c.icon}</span>
              <div className="flex-1">
                <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-bold">{c.cmd}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bot Features */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Bot Features
        </h4>
        <div className="space-y-3">
          {[
            { icon: '📩', label: 'Order Forwarding', desc: 'All user messages forwarded to admin with action buttons' },
            { icon: '✅', label: 'Confirm/Reject/Ship', desc: 'Inline buttons to manage orders from Telegram' },
            { icon: '📢', label: 'Broadcast', desc: 'Send announcements to all bot users' },
            { icon: '🚫', label: 'Ban System', desc: 'Silently block spammers/fake users' },
            { icon: '🛍️', label: 'Product Catalog', desc: '2-column button grid with product details' },
            { icon: '💳', label: 'Payment Info', desc: 'UPI & Binance payment details on buy' },
            { icon: '📊', label: 'Sales Reports', desc: 'Daily & all-time analytics via /report' },
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

      {/* User Commands */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          User Commands
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
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open('https://t.me/BotFather', '_blank')}>
            🤖 BotFather
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open('https://core.telegram.org/bots/api', '_blank')}>
            📖 Bot API Docs
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminTelegramBot;
