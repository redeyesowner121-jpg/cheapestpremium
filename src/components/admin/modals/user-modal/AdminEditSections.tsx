import React from 'react';
import { Award, Gift, Wallet, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminEditSectionsProps {
  user: any;
  ranks: any[];
  walletBalanceInput: string;
  setWalletBalanceInput: (v: string) => void;
  giftAmount: string;
  setGiftAmount: (v: string) => void;
  rankBalanceInput: string;
  setRankBalanceInput: (v: string) => void;
  onUpdateWalletBalance: () => void;
  onGiftMoney: () => void;
  onUpdateRankBalance: () => void;
  onSetRank: (rankId: string) => void;
  getCurrentRank: () => any;
}

const AdminEditSections: React.FC<AdminEditSectionsProps> = ({
  user, ranks,
  walletBalanceInput, setWalletBalanceInput,
  giftAmount, setGiftAmount,
  rankBalanceInput, setRankBalanceInput,
  onUpdateWalletBalance, onGiftMoney, onUpdateRankBalance, onSetRank, getCurrentRank,
}) => {
  return (
    <>
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Wallet className="w-4 h-4 text-green-600" />
          Edit Wallet Balance
        </p>
        <div className="flex gap-2">
          <Input type="number" placeholder={`Current: ₹${user.wallet_balance || 0}`} value={walletBalanceInput} onChange={(e) => setWalletBalanceInput(e.target.value)} className="flex-1" />
          <Button onClick={onUpdateWalletBalance} size="sm" className="bg-green-600 hover:bg-green-700">Set</Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-600" />
          Gift / Deduct Money
        </p>
        <p className="text-xs text-muted-foreground">Positive = Add | Negative = Deduct (e.g. -50)</p>
        <div className="flex gap-2">
          <Input type="number" placeholder="e.g. 100 or -50" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="flex-1" />
          <Button onClick={onGiftMoney} size="sm" className="bg-amber-600 hover:bg-amber-700">
            <Gift className="w-4 h-4 mr-1" />Apply
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Award className="w-4 h-4 text-purple-600" />
          Update Rank Balance
        </p>
        <div className="flex gap-2">
          <Input type="number" placeholder={`Current: ₹${user.rank_balance || 0}`} value={rankBalanceInput} onChange={(e) => setRankBalanceInput(e.target.value)} className="flex-1" />
          <Button onClick={onUpdateRankBalance} size="sm" className="bg-purple-600 hover:bg-purple-700">Update</Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-600" />
          Set Rank
          {getCurrentRank() && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-full">
              Current: {getCurrentRank()?.icon} {getCurrentRank()?.name}
            </span>
          )}
        </p>
        <Select onValueChange={onSetRank} value={getCurrentRank()?.id || ''}>
          <SelectTrigger><SelectValue placeholder="Select rank..." /></SelectTrigger>
          <SelectContent>
            {ranks.map((rank) => (
              <SelectItem key={rank.id} value={rank.id}>
                {rank.icon} {rank.name} (Min: ₹{rank.min_balance})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

export default AdminEditSections;
