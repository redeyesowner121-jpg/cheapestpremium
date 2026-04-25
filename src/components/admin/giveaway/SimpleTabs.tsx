import React from 'react';
import { Eye, Radio, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const UsersTab: React.FC<{ topUsers: any[]; onUserClick: (tgId: number) => void }> = ({ topUsers, onUserClick }) => (
  <div className="bg-card rounded-2xl border border-border p-4">
    <h4 className="font-semibold mb-3">👥 All Giveaway Users ({topUsers.length})</h4>
    <div className="space-y-1.5 max-h-96 overflow-y-auto">
      {topUsers.map((u, i) => (
        <div key={u.telegram_id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50"
          onClick={() => onUserClick(u.telegram_id)}>
          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{u.name}</p>
            <p className="text-xs text-muted-foreground"><code>{u.telegram_id}</code></p>
          </div>
          <Badge variant="secondary" className="text-xs">🎯{u.points}</Badge>
          <Badge variant="outline" className="text-xs">👥{u.total_referrals}</Badge>
          <Eye className="w-4 h-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  </div>
);

export const RedemptionsTab: React.FC<{ redemptions: any[] }> = ({ redemptions }) => (
  <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
    <h4 className="font-semibold mb-2">🎁 Redemptions</h4>
    {redemptions.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">No redemptions yet</p>
    ) : redemptions.map(r => (
      <div key={r.id} className="p-3 bg-muted/30 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{r.giveaway_product?.product?.name || '?'}</p>
            <p className="text-xs text-muted-foreground">
              TG: <code>{r.telegram_id}</code> • {r.points_spent} pts • {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={r.status === 'completed' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
            {r.status === 'completed' ? '✅' : r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '⏳'} {r.status}
          </Badge>
        </div>
      </div>
    ))}
  </div>
);

export const ChannelsTab: React.FC<{ channels: string[] }> = ({ channels }) => (
  <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
    <h4 className="font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Required Channels</h4>
    <p className="text-xs text-muted-foreground">Giveaway bot channels are hardcoded. Contact the developer to make changes.</p>
    {channels.map((ch, i) => (
      <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl">
        <Radio className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium flex-1">{ch}</span>
        <Button size="sm" variant="outline" className="rounded-lg text-xs"
          onClick={() => window.open(`https://t.me/${ch.replace('@', '')}`, '_blank')}>
          Open
        </Button>
      </div>
    ))}
  </div>
);

interface SettingsTabProps {
  pointsPerReferral: string;
  onPointsPerReferralChange: (v: string) => void;
  onSave: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ pointsPerReferral, onPointsPerReferralChange, onSave }) => (
  <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
    <h4 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Giveaway Settings</h4>
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Points Per Referral</label>
      <div className="flex gap-2">
        <Input type="number" value={pointsPerReferral} onChange={e => onPointsPerReferralChange(e.target.value)} className="rounded-xl" />
        <Button onClick={onSave} className="rounded-xl">Save</Button>
      </div>
      <p className="text-xs text-muted-foreground">Points awarded for each successful referral</p>
    </div>
  </div>
);
