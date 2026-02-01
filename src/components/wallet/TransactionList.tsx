import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Gift, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions }) => {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'withdraw':
      case 'transfer_out':
        return <ArrowUpRight className="w-5 h-5 text-destructive" />;
      case 'purchase':
        return <CreditCard className="w-5 h-5 text-primary" />;
      case 'refund':
      case 'transfer_in':
        return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'bonus':
      case 'gift':
        return <Gift className="w-5 h-5 text-accent" />;
      case 'referral':
        return <TrendingUp className="w-5 h-5 text-secondary" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-accent" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">Recent Transactions</h2>
        <button className="text-sm text-primary font-medium">See All</button>
      </div>

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          transactions.map((txn, index) => (
            <motion.div
              key={txn.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4"
            >
              <div className="p-2 rounded-xl bg-muted">
                {getTransactionIcon(txn.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{txn.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(txn.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${['purchase', 'withdraw', 'transfer_out'].includes(txn.type) ? 'text-destructive' : 'text-success'}`}>
                  {['purchase', 'withdraw', 'transfer_out'].includes(txn.type) ? '-' : '+'}₹{Math.abs(txn.amount)}
                </p>
                <div className="flex items-center justify-end gap-1">
                  {getStatusIcon(txn.status)}
                  <span className="text-xs text-muted-foreground capitalize">
                    {txn.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default TransactionList;