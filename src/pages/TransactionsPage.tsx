import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Gift, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

const TransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const filteredTransactions = transactions.filter(txn => {
    if (filter === 'all') return true;
    return txn.type === filter;
  });

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
      case 'admin_credit':
        return <Gift className="w-5 h-5 text-accent" />;
      case 'referral':
        return <TrendingUp className="w-5 h-5 text-secondary" />;
      case 'admin_debit':
        return <ArrowUpRight className="w-5 h-5 text-destructive" />;
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

  const isDebit = (type: string) => {
    return ['purchase', 'withdraw', 'transfer_out', 'admin_debit'].includes(type);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/wallet')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">All Transactions</h1>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="deposit">Deposits</SelectItem>
              <SelectItem value="purchase">Purchases</SelectItem>
              <SelectItem value="refund">Refunds</SelectItem>
              <SelectItem value="transfer_in">Received</SelectItem>
              <SelectItem value="transfer_out">Sent</SelectItem>
              <SelectItem value="gift">Gifts</SelectItem>
              <SelectItem value="referral">Referrals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-success/10 rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Total Credited</p>
            <p className="text-xl font-bold text-success">
              +₹{transactions
                .filter(t => !isDebit(t.type) && t.status === 'completed')
                .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                .toFixed(2)}
            </p>
          </div>
          <div className="bg-destructive/10 rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="text-xl font-bold text-destructive">
              -₹{transactions
                .filter(t => isDebit(t.type) && t.status === 'completed')
                .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                .toFixed(2)}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map((txn, index) => (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4"
              >
                <div className="p-2 rounded-xl bg-muted">
                  {getTransactionIcon(txn.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{txn.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(txn.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isDebit(txn.type) ? 'text-destructive' : 'text-success'}`}>
                    {isDebit(txn.type) ? '-' : '+'}₹{Math.abs(txn.amount).toFixed(2)}
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
      </main>

      <BottomNav />
    </div>
  );
};

export default TransactionsPage;
