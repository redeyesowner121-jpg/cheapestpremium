import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BotUserModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedUser: any;
  userHistory: any[];
  onToggleBan: (tgId: number, ban: boolean) => void;
  onToggleReseller: (tgId: number) => void;
}

const BotUserModal: React.FC<BotUserModalProps> = ({
  open, onOpenChange, selectedUser, userHistory, onToggleBan, onToggleReseller,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>👤 User Details</DialogTitle>
      </DialogHeader>
      {selectedUser && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.first_name || '?'}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-mono text-xs">{selectedUser.telegram_id}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-green-600">₹{selectedUser.wallet?.balance || 0}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Reseller</p>
              <p>{selectedUser.wallet?.is_reseller ? '✅ Yes' : '❌ No'}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Status</p>
              <p>{selectedUser.is_banned ? '🚫 Banned' : '✅ Active'}</p>
            </div>
            <div className="bg-muted/30 p-2 rounded-xl">
              <p className="text-xs text-muted-foreground">Earned</p>
              <p className="font-medium">₹{selectedUser.wallet?.total_earned || 0}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 rounded-xl" variant={selectedUser.is_banned ? 'default' : 'destructive'}
              onClick={() => onToggleBan(selectedUser.telegram_id, !selectedUser.is_banned)}>
              {selectedUser.is_banned ? '✅ Unban' : '🚫 Ban'}
            </Button>
            <Button size="sm" className="flex-1 rounded-xl" variant="outline"
              onClick={() => onToggleReseller(selectedUser.telegram_id)}>
              🔄 Toggle Reseller
            </Button>
          </div>

          {userHistory.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">📦 Orders ({userHistory.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {userHistory.map((o: any) => (
                  <div key={o.id} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                    <span>{o.status === 'confirmed' ? '✅' : o.status === 'rejected' ? '❌' : '⏳'}</span>
                    <span className="flex-1 truncate">{o.product_name}</span>
                    <span className="font-bold">₹{o.amount}</span>
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

export default BotUserModal;
