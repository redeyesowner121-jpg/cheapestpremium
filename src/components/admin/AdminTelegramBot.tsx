import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, Users, MessageCircle, Shield, Zap, CheckCircle, XCircle, Globe, Package, Wallet, Languages, Brain } from 'lucide-react';
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
  totalWallets: number;
  totalResellers: number;
}

const AdminTelegramBot: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [botStats, setBotStats] = useState<BotStats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('telegram-set-webhook', { method: 'POST' });

      const [usersRes, ordersRes, pendingRes, confirmedRes, walletsRes, resellersRes] = await Promise.all([
        supabase.from('telegram_bot_users' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('telegram_wallets' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_wallets' as any).select('*', { count: 'exact', head: true }).eq('is_reseller', true),
      ]);

      setBotStats({
        webhookSet: data?.success || false,
        webhookUrl: data?.webhook_url || '',
        totalUsers: (usersRes as any).count || 0,
        totalOrders: (ordersRes as any).count || 0,
        pendingOrders: (pendingRes as any).count || 0,
        confirmedOrders: (confirmedRes as any).count || 0,
        totalWallets: (walletsRes as any).count || 0,
        totalResellers: (resellersRes as any).count || 0,
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
      {/* Bot Status */}
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <Bot className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Telegram Bot</h3>
            <p className="text-sm text-muted-foreground">Bilingual E-commerce Bot</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            botStats?.webhookSet ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-500'
          }`}>
            {botStats?.webhookSet ? <><CheckCircle className="w-3.5 h-3.5" /> Active</> : <><XCircle className="w-3.5 h-3.5" /> Inactive</>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Users', value: botStats?.totalUsers || 0, icon: Users, color: 'text-blue-500' },
            { label: 'Orders', value: botStats?.totalOrders || 0, icon: Package, color: 'text-purple-500' },
            { label: 'Pending', value: botStats?.pendingOrders || 0, icon: CheckCircle, color: 'text-yellow-500' },
            { label: 'Confirmed', value: botStats?.confirmedOrders || 0, icon: CheckCircle, color: 'text-green-500' },
            { label: 'Wallets', value: botStats?.totalWallets || 0, icon: Wallet, color: 'text-orange-500' },
            { label: 'Resellers', value: botStats?.totalResellers || 0, icon: Users, color: 'text-cyan-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking...' : 'Refresh Stats'}
        </Button>
      </div>

      {/* Admin Commands */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Admin Commands
        </h4>
        <div className="space-y-2">
          {[
            { cmd: '/admin', desc: 'Open admin dashboard', icon: '🔐' },
            { cmd: '/broadcast', desc: 'Send to all users', icon: '📢' },
            { cmd: '/report or /stats', desc: 'Analytics & revenue', icon: '📊' },
            { cmd: '/add_product', desc: 'Add new product', icon: '➕' },
            { cmd: '/edit_price [name] [price]', desc: 'Update price', icon: '✏️' },
            { cmd: '/out_stock [name]', desc: 'Mark out of stock', icon: '❌' },
            { cmd: '/users', desc: 'User stats', icon: '👥' },
            { cmd: '/history [id]', desc: 'Order history', icon: '📜' },
            { cmd: '/ban [id]', desc: 'Ban user', icon: '🚫' },
            { cmd: '/unban [id]', desc: 'Unban user', icon: '✅' },
            { cmd: '/make_reseller [id]', desc: 'Toggle reseller status', icon: '🔄' },
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

      {/* Features */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Bot Features
        </h4>
        <div className="space-y-3">
          {[
            { icon: '🌐', label: 'Bilingual (EN/BN)', desc: 'English & Bengali interface with auto-detection' },
            { icon: '🤖', label: 'AI Assistant', desc: 'Smart AI answers product queries with no-return policy' },
            { icon: '🔒', label: 'Forced Channel Join', desc: 'Users must join channels before using bot' },
            { icon: '💰', label: 'Bot Wallet', desc: 'Internal wallet with balance, referral bonuses' },
            { icon: '🎁', label: 'Referral System', desc: 'Unique referral links with bonus on first purchase' },
            { icon: '🔄', label: 'Reseller System', desc: 'Custom resale links with profit distribution' },
            { icon: '📂', label: 'Category Menu', desc: 'Multi-level: Categories → Products → Variations' },
            { icon: '📩', label: 'Order Forwarding', desc: 'All messages forwarded with action buttons' },
            { icon: '✅', label: 'Confirm/Reject/Ship', desc: 'Inline admin buttons for order management' },
            { icon: '💳', label: 'Wallet + Payment', desc: 'Wallet deduction + QR/UPI for remaining' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-xl">
              <span className="text-xl">{f.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
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
            { cmd: '/start', desc: 'Language → Channel verify → Main menu' },
            { cmd: '/products', desc: 'Browse categories & products' },
            { cmd: '/help', desc: 'Show help' },
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
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open('https://t.me/Cheapest_Premiums_bot', '_blank')}>
            🤖 Open Bot
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open('https://t.me/pocket_money27', '_blank')}>
            📢 Channel 1
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open('https://t.me/RKRxOTT', '_blank')}>
            📢 Channel 2
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminTelegramBot;
