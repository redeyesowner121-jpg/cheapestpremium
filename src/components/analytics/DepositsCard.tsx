import React, { memo } from 'react';
import { IndianRupee } from 'lucide-react';

interface User {
  id: string;
  total_deposit?: number;
}

interface DepositsCardProps {
  totalDeposits: number;
  users: User[];
}

const DepositsCard: React.FC<DepositsCardProps> = ({ totalDeposits, users }) => {
  const activeDepositors = users.filter(u => (u.total_deposit || 0) > 0).length;
  const avgPerUser = users.length > 0 ? Math.round(totalDeposits / users.length) : 0;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-success" />
          Total Deposits
        </h3>
      </div>
      <div className="h-40 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-success">
          ₹{totalDeposits.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          From {users.length} users
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">₹{avgPerUser}</p>
            <p className="text-[10px] text-muted-foreground">Avg per user</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{activeDepositors}</p>
            <p className="text-[10px] text-muted-foreground">Active depositors</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(DepositsCard);