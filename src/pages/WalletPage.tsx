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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  React.useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setTransactions(data);
    }
  };

  const quickAmounts = [100, 200, 500, 1000, 2000];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleDeposit = async () => {
    if (!user || !profile) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error('Minimum deposit is Rs 10');
      return;
    }

    setLoading(true);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      // Create Razorpay order via edge function
      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay-order', {
        body: { amount, userId: user.id }
      });

      if (orderError || !orderData) {
        toast.error('Failed to create payment order');
        setLoading(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'RKR Premium Store',
        description: `Wallet Deposit - Rs ${amount}`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          // Verify payment
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay-verify', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id,
              amount
            }
          });

          if (verifyError || !verifyData?.success) {
            toast.error('Payment verification failed');
            return;
          }

          if (verifyData.bonusAmount > 0) {
            toast.success(`🎉 You got Rs${verifyData.bonusAmount} bonus!`);
          }
          if (verifyData.gotBlueTick) {
            toast.success('🎉 You earned your Blue Tick!');
          }

          toast.success('Deposit successful!');
          refreshProfile();
          loadTransactions();
          setShowDepositModal(false);
          setDepositAmount('');
        },
        prefill: {
          email: profile.email,
          contact: profile.phone || ''
        },
        theme: {
          color: '#4f46e5'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      toast.error(error.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

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
            ₹{profile?.wallet_balance?.toFixed(2) || '0.00'}
          </h1>
          
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-primary-foreground/60 text-xs">Total Deposit</p>
              <p className="text-primary-foreground font-semibold">
                ₹{profile?.total_deposit?.toFixed(2) || '0.00'}
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
              onClick={() => setShowDepositModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">UPI</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDepositModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-2">
                <QrCode className="w-6 h-6 text-secondary" />
              </div>
              <span className="text-sm font-medium text-foreground">QR Pay</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDepositModal(true)}
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
              ))
            )}
          </div>
        </motion.div>
      </main>

      {/* Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Money</DialogTitle>
            <DialogDescription>
              Deposit Rs1000+ at once to get Rs100 bonus + Blue Tick!
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
