import React from 'react';
import { TrendingUp, RefreshCw, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  stats: any;
  topUsers: any[];
  channelCount: number;
  loading: boolean;
  onRefresh: () => void;
  onUserClick: (tgId: number) => void;
}

export const OverviewTab: React.FC<Props> = ({
  stats, topUsers, channelCount, loading, onRefresh, onUserClick,
}) => (
  <div className="space-y-4">
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-4 border border-purple-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-xl"><Gift className="w-6 h-6 text-purple-500" /></div>
          <div>
            <h3 className="font-bold text-foreground">Giveaway Bot</h3>
            <p className="text-xs text-muted-foreground">@RKRxGiveaway_bot</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Users', value: stats?.totalUsers || 0, color: 'text-purple-500' },
          { label: 'Total Pts', value: stats?.totalPoints || 0, color: 'text-yellow-500' },
          { label: 'Referrals', value: stats?.totalReferrals || 0, color: 'text-blue-500' },
          { label: 'Products', value: stats?.activeProducts || 0, color: 'text-green-500' },
          { label: 'Redeemed', value: stats?.totalRedemptions || 0, color: 'text-orange-500' },
          { label: 'Channels', value: channelCount, color: 'text-cyan-500' },
        ].map((s, i) => (
          <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-card rounded-2xl border border-border p-4">
      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" /> Top Users
      </h4>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {topUsers.map((u, i) => (
          <div key={u.telegram_id}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50"
            onClick={() => onUserClick(u.telegram_id)}>
            <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{u.name}</p>
            </div>
            <Badge variant="secondary" className="text-xs">🎯 {u.points}</Badge>
            <Badge variant="outline" className="text-xs">👥 {u.total_referrals}</Badge>
          </div>
        ))}
      </div>
    </div>
  </div>
);
