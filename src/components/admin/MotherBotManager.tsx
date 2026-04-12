import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Users, ShoppingCart, DollarSign, Power, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

interface ChildBot {
  id: string;
  bot_username: string;
  owner_telegram_id: number;
  revenue_percent: number;
  is_active: boolean;
  total_earnings: number;
  total_orders: number;
  created_at: string;
}

const MotherBotManager: React.FC = () => {
  const [bots, setBots] = useState<ChildBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBots: 0, activeBots: 0, totalOrders: 0, totalEarnings: 0, totalUsers: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: botsData } = await (supabase as any).from('child_bots').select('*').order('created_at', { ascending: false });
      const { count: usersCount } = await (supabase as any).from('mother_bot_users').select('id', { count: 'exact', head: true });

      const botsList = botsData || [];
      setBots(botsList);
      setStats({
        totalBots: botsList.length,
        activeBots: botsList.filter((b: ChildBot) => b.is_active).length,
        totalOrders: botsList.reduce((s: number, b: ChildBot) => s + b.total_orders, 0),
        totalEarnings: botsList.reduce((s: number, b: ChildBot) => s + b.total_earnings, 0),
        totalUsers: usersCount || 0,
      });
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const toggleBot = async (bot: ChildBot) => {
    await (supabase as any).from('child_bots').update({ is_active: !bot.is_active }).eq('id', bot.id);
    toast.success(bot.is_active ? 'Bot deactivated' : 'Bot activated');
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Bots', value: stats.totalBots, icon: Bot },
          { label: 'Active', value: stats.activeBots, icon: Power },
          { label: 'Mother Users', value: stats.totalUsers, icon: Users },
          { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart },
          { label: 'Commissions', value: `₹${stats.totalEarnings}`, icon: DollarSign },
        ].map((s, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3 text-center">
              <s.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bots List */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Child Bots</CardTitle>
          <Button variant="ghost" size="icon" onClick={loadData}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {bots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No child bots created yet. Users can create bots via the Mother Bot on Telegram.</p>
          ) : (
            bots.map(bot => (
              <div key={bot.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">@{bot.bot_username || 'unknown'}</span>
                    <Badge variant={bot.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {bot.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Owner: {bot.owner_telegram_id} · Revenue: {bot.revenue_percent}% · Orders: {bot.total_orders} · Earned: ₹{bot.total_earnings}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Created: {new Date(bot.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Switch checked={bot.is_active} onCheckedChange={() => toggleBot(bot)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MotherBotManager;
