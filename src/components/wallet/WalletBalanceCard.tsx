import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

interface WalletBalanceCardProps {
  walletBalance: number;
  totalDeposit: number;
  onAddMoney: () => void;
  onWithdraw: () => void;
}

const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  walletBalance,
  totalDeposit,
  onAddMoney,
  onWithdraw
}) => {
  const { settings } = useAppSettingsContext();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-primary rounded-3xl p-6 text-center shadow-glow"
    >
      <p className="text-primary-foreground/80 text-sm">Available Balance</p>
      <h1 className="text-4xl font-bold text-primary-foreground mt-2">
        {settings.currency_symbol}{walletBalance?.toFixed(2) || '0.00'}
      </h1>
      <p className="text-primary-foreground/60 text-sm mt-1">
        ≈ ${(walletBalance / 95).toFixed(2)} USD
      </p>
      
      <div className="flex items-center justify-center gap-6 mt-6">
        <div className="text-center">
          <p className="text-primary-foreground/60 text-xs">Total Deposit</p>
          <p className="text-primary-foreground font-semibold">
            {settings.currency_symbol}{totalDeposit?.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="w-px h-10 bg-primary-foreground/20" />
        <div className="text-center">
          <p className="text-primary-foreground/60 text-xs">Total Spent</p>
          <p className="text-primary-foreground font-semibold">{settings.currency_symbol}0.00</p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Button
          onClick={onAddMoney}
          className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-primary-foreground rounded-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Money
        </Button>
        <Button
          onClick={onWithdraw}
          variant="outline"
          className="flex-1 h-12 border-white/30 text-primary-foreground hover:bg-white/10 rounded-xl"
        >
          <Minus className="w-5 h-5 mr-2" />
          Withdraw
        </Button>
      </div>
    </motion.div>
  );
};

export default WalletBalanceCard;