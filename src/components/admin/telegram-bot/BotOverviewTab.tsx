import React from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BotOverviewTabProps {
  stats: any;
  loading: boolean;
  onRefresh: () => void;
}

const BotOverviewTab: React.FC<BotOverviewTabProps> = ({ stats, loading, onRefresh }) => (
  <div className="space-y-4">
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl"><Bot className="w-6 h-6 text-blue-500" /></div>
          <div>
            <h3 className="font-bold text-foreground">Selling Bot</h3>
            <p className="text-xs text-muted-foreground">@Air1_Premium_bot</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Users', value: stats?.totalUsers || 0, color: 'text-blue-500' },
          { label: 'Orders', value: stats?.totalOrders || 0, color: 'text-purple-500' },
          { label: 'Pending', value: stats?.pendingOrders || 0, color: 'text-yellow-500' },
          { label: 'Confirmed', value: stats?.confirmedOrders || 0, color: 'text-green-500' },
          { label: 'Resellers', value: stats?.totalResellers || 0, color: 'text-cyan-500' },
          { label: 'Wallet Total', value: `₹${stats?.totalBalance || 0}`, color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-background/50 rounded-xl p-3">
        <p className="text-xs text-muted-foreground mb-1">📊 Revenue</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">₹{stats?.todayRevenue || 0}</p>
            <p className="text-xs text-muted-foreground">Today ({stats?.todayOrders || 0} orders)</p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">₹{stats?.allRevenue || 0}</p>
            <p className="text-xs text-muted-foreground">All Time</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default BotOverviewTab;
