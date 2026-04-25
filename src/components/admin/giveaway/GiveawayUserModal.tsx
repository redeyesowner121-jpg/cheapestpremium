import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export const GiveawayUserModal: React.FC<Props> = ({ open, onOpenChange, user }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle>👤 Giveaway User</DialogTitle></DialogHeader>
      {user && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{user.username ? `@${user.username}` : user.first_name || '?'}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-mono text-xs">{user.telegram_id}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Points</p>
              <p className="font-bold text-yellow-600">🎯 {user.points?.points || 0}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Referrals</p>
              <p className="font-bold">👥 {user.points?.total_referrals || 0}</p>
            </div>
          </div>
          {user.referrals?.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">📎 Referrals ({user.referrals.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {user.referrals.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                    <span>👤 <code>{r.referred_telegram_id}</code></span>
                    <span className="ml-auto">+{r.points_awarded} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {user.redemptions?.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">🎁 Redemptions ({user.redemptions.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {user.redemptions.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                    <span>{r.status === 'completed' ? '✅' : '⏳'}</span>
                    <span className="flex-1 truncate">{r.giveaway_product?.product?.name || '?'}</span>
                    <span>{r.points_spent} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>
);
