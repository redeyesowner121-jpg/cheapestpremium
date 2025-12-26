import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Minus, 
  CreditCard, 
  Smartphone, 
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  Gift,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { ref, update, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'purchase' | 'refund' | 'bonus' | 'referral';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: number;
}

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { userData, user, updateUserData } = useAuth();
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const quickAmounts = [100, 200, 500, 1000, 2000];

  const handleDeposit = async () => {
    if (!user || !userData) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error('Minimum deposit is ₹10');
      return;
    }

    setLoading(true);

    try {
      let bonusAmount = 0;
      let shouldGetBlueTick = false;

      // Check for ₹1000 single deposit bonus
      if (amount >= 1000) {
        bonusAmount = 100;
        shouldGetBlueTick = true;
        toast.success('🎉 Congrats! You got ₹100 bonus + Blue Tick!');
      }

      const newTotalDeposit = (userData.totalDeposit || 0) + amount;
      
      // Check for total ₹1000 deposit blue tick
      if (!shouldGetBlueTick && newTotalDeposit >= 1000 && !userData.hasBlueCheck) {
        shouldGetBlueTick = true;
        toast.success('🎉 You earned your Blue Tick!');
      }

      const newBalance = (userData.walletBalance || 0) + amount + bonusAmount;

      // Update user data
      await update(ref(database, `users/${user.uid}`), {
        walletBalance: newBalance,
        totalDeposit: newTotalDeposit,
        hasBlueCheck: shouldGetBlueTick || userData.hasBlueCheck,
      });

      // Add transaction record
      const transactionRef = push(ref(database, `transactions/${user.uid}`));
      await set(transactionRef, {
        type: 'deposit',
        amount: amount,
        bonus: bonusAmount,
        status: 'completed',
        description: `Deposited ₹${amount}${bonusAmount > 0 ? ` + ₹${bonusAmount} bonus` : ''}`,
        createdAt: Date.now(),
      });

      setShowDepositModal(false);
      setDepositAmount('');
      toast.success('Deposit successful!');
    } catch (error: any) {
      toast.error(error.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const transactions: Transaction[] = [
    {
      id: '1',
      type: 'deposit',
      amount: 500,
      status: 'completed',
      description: 'UPI Deposit',
      createdAt: Date.now() - 86400000,
    },
    {
      id: '2',
      type: 'purchase',
      amount: -79,
      status: 'completed',
      description: 'Netflix Premium',
      createdAt: Date.now() - 172800000,
    },
    {
      id: '3',
      type: 'bonus',
      amount: 100,
      status: 'completed',
      description: 'First Deposit Bonus',
      createdAt: Date.now() - 259200000,
    },
  ];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'withdraw':
        return <ArrowUpRight className="w-5 h-5 text-destructive" />;
      case 'purchase':
        return <CreditCard className="w-5 h-5 text-primary" />;
      case 'refund':
        return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'bonus':
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
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-primary rounded-3xl p-6 text-center shadow-glow"
        >
          <p className="text-primary-foreground/80 text-sm">Available Balance</p>
          <h1 className="text-4xl font-bold text-primary-foreground mt-2">
            ₹{userData?.walletBalance?.toFixed(2) || '0.00'}
          </h1>
          
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-primary-foreground/60 text-xs">Total Deposit</p>
              <p className="text-primary-foreground font-semibold">
                ₹{userData?.totalDeposit?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="w-px h-10 bg-primary-foreground/20" />
            <div className="text-center">
              <p className="text-primary-foreground/60 text-xs">Total Spent</p>
              <p className="text-primary-foreground font-semibold">₹0.00</p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => setShowDepositModal(true)}
              className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-primary-foreground rounded-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Money
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 border-white/30 text-primary-foreground hover:bg-white/10 rounded-xl"
            >
              <Minus className="w-5 h-5 mr-2" />
              Withdraw
            </Button>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">UPI</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-2">
                <QrCode className="w-6 h-6 text-secondary" />
              </div>
              <span className="text-sm font-medium text-foreground">QR Pay</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground">Card</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Transactions */}
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
            {transactions.map((txn, index) => (
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
                    {new Date(txn.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${txn.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {txn.amount >= 0 ? '+' : ''}₹{Math.abs(txn.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {getStatusIcon(txn.status)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {txn.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Money</DialogTitle>
            <DialogDescription>
              Deposit ₹1000+ at once to get ₹100 bonus + Blue Tick!
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Input
              type="number"
              placeholder="Enter amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="h-14 text-2xl text-center font-bold rounded-xl"
            />

            <div className="flex flex-wrap gap-2 mt-4">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(amount.toString())}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    depositAmount === amount.toString()
                      ? 'gradient-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            <Button
              onClick={handleDeposit}
              className="w-full h-12 mt-6 btn-gradient rounded-xl"
              disabled={loading || !depositAmount}
            >
              {loading ? 'Processing...' : `Deposit ₹${depositAmount || '0'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default WalletPage;
