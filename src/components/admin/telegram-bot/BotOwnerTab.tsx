import React from 'react';
import { Crown, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BotOwnerTabProps {
  admins: any[];
  newAdminId: string;
  setNewAdminId: (v: string) => void;
  onAddAdmin: () => void;
  onRemoveAdmin: (tgId: number) => void;
}

const BotOwnerTab: React.FC<BotOwnerTabProps> = ({ admins, newAdminId, setNewAdminId, onAddAdmin, onRemoveAdmin }) => (
  <div className="space-y-3">
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" /> Bot Admins</h4>
      <div className="p-2 bg-yellow-500/10 rounded-xl">
        <p className="text-sm font-medium">👑 <code>6898461453</code> — Super Admin (Owner)</p>
      </div>
      {admins.map(a => (
        <div key={a.telegram_id} className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
          <div>
            <p className="text-sm font-medium">{a.name}</p>
            <p className="text-xs text-muted-foreground"><code>{a.telegram_id}</code></p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => onRemoveAdmin(a.telegram_id)}>
            <UserMinus className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="Telegram ID" value={newAdminId} onChange={e => setNewAdminId(e.target.value)} className="rounded-xl" />
        <Button className="rounded-xl" onClick={onAddAdmin}><UserPlus className="w-4 h-4" /></Button>
      </div>
    </div>
  </div>
);

export default BotOwnerTab;
