import React from 'react';
import { Plus, Minus, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BotWalletTabProps {
  walletTgId: string;
  setWalletTgId: (v: string) => void;
  walletAmount: string;
  setWalletAmount: (v: string) => void;
  onWalletAction: (action: 'add' | 'deduct') => void;
}

const BotWalletTab: React.FC<BotWalletTabProps> = ({
  walletTgId, setWalletTgId, walletAmount, setWalletAmount, onWalletAction,
}) => (
  <div className="space-y-3">
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Wallet Management</h4>
      <Input placeholder="Telegram ID" value={walletTgId} onChange={e => setWalletTgId(e.target.value)} className="rounded-xl" />
      <Input placeholder="Amount (₹)" type="number" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Button className="rounded-xl bg-green-600 hover:bg-green-700" onClick={() => onWalletAction('add')}>
          <Plus className="w-4 h-4 mr-1" /> Add Balance
        </Button>
        <Button variant="destructive" className="rounded-xl" onClick={() => onWalletAction('deduct')}>
          <Minus className="w-4 h-4 mr-1" /> Deduct Balance
        </Button>
      </div>
    </div>
  </div>
);

export default BotWalletTab;
