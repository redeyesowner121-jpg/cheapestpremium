import React, { useState, useEffect } from 'react';
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
  TrendingUp,
  Send,
  User,
  Search,
  ExternalLink,
  AlertCircle,
  Copy,
  Loader2
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SuccessModal from '@/components/SuccessModal';
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

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
}

interface PaymentSettings {
  automatic_payment: { is_enabled: boolean };
  manual_payment_qr: { setting_value: string | null; is_enabled: boolean };
  manual_payment_link: { setting_value: string | null; is_enabled: boolean };
  manual_payment_instructions: { setting_value: string | null };
}

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{type: 'deposit' | 'bonus'; title: string; message: string; details: {label: string; value: string}[]}>({
    type: 'deposit',
    title: '',
    message: '',
    details: []
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Manual deposit states
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>('auto');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  useEffect(() => {
    if (user) {
      loadTransactions();
      loadPaymentSettings();
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

  const loadPaymentSettings = async () => {
    const { data } = await supabase
      .from('payment_settings')
      .select('*');
    
    if (data) {
      const settings: any = {};
      data.forEach(s => {
        settings[s.setting_key] = {
          setting_value: s.setting_value,
          is_enabled: s.is_enabled
        };
      });
      setPaymentSettings(settings);
      
      // Set default tab based on what's available
      if (!settings.automatic_payment?.is_enabled) {
        setDepositTab('manual');
      }
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

          const details: {label: string; value: string}[] = [
            { label: 'Amount Added', value: `₹${amount}` }
          ];
          
          if (verifyData.bonusAmount > 0) {
            details.push({ label: 'Bonus Earned', value: `₹${verifyData.bonusAmount}` });
          }
          if (verifyData.gotBlueTick) {
            details.push({ label: 'Special Reward', value: '✓ Blue Tick Unlocked!' });
          }

          setSuccessData({
            type: verifyData.bonusAmount > 0 ? 'bonus' : 'deposit',
            title: verifyData.bonusAmount > 0 ? 'Bonus Claimed! 🎉' : 'Deposit Successful!',
            message: verifyData.bonusAmount > 0 
              ? 'Congratulations! You earned bonus money!' 
              : 'Your wallet has been credited successfully',
            details
          });
          
          refreshProfile();
          loadTransactions();
          setShowDepositModal(false);
          setDepositAmount('');
          setShowSuccessModal(true);
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

  // Handle manual deposit request
  const handleManualDeposit = async () => {
    if (!user || !profile) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error('Minimum deposit is Rs 10');
      return;
    }

    if (!transactionId.trim()) {
      toast.error('Please enter Transaction ID');
      return;
    }

    setSubmittingManual(true);
    try {
      const { error } = await supabase.from('manual_deposit_requests').insert({
        user_id: user.id,
        amount,
        transaction_id: transactionId.trim(),
        payment_method: 'qr',
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Deposit request submitted! Waiting for admin approval.');
      setShowDepositModal(false);
      setDepositAmount('');
      setTransactionId('');
    } catch (error: any) {
      toast.error('Failed to submit request');
    } finally {
      setSubmittingManual(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Search for users to transfer money
  const handleSearchUsers = async (query: string) => {
    setSearchUser(query);
    if (query.length < 2) {
      setFoundUsers([]);
      return;
    }
    
    setSearchingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, referral_code')
      .neq('id', user?.id)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,referral_code.ilike.%${query}%`)
      .limit(5);
    
    setFoundUsers(data || []);
    setSearchingUsers(false);
  };

  // Handle money transfer
  const handleTransfer = async () => {
    if (!user || !profile || !selectedRecipient) return;
    
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > (profile.wallet_balance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      // Deduct from sender
      const newSenderBalance = (profile.wallet_balance || 0) - amount;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newSenderBalance })
        .eq('id', user.id);

      // Add to receiver
      const { data: recipientData } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', selectedRecipient.id)
        .single();

      const newRecipientBalance = (recipientData?.wallet_balance || 0) + amount;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newRecipientBalance })
        .eq('id', selectedRecipient.id);

      // Create transactions for both
      await supabase.from('transactions').insert([
        {
          user_id: user.id,
          type: 'transfer_out',
          amount: -amount,
          status: 'completed',
          description: `Transfer to ${selectedRecipient.name}`
        },
        {
          user_id: selectedRecipient.id,
          type: 'transfer_in',
          amount: amount,
          status: 'completed',
          description: `Transfer from ${profile.name}`
        }
      ]);

      // Send notification to recipient
      await supabase.from('notifications').insert({
        user_id: selectedRecipient.id,
        title: 'Money Received! 💰',
        message: `You received ₹${amount} from ${profile.name}${transferNote ? ` - "${transferNote}"` : ''}`,
        type: 'wallet'
      });

      toast.success(`₹${amount} sent to ${selectedRecipient.name}`);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferNote('');
      setSelectedRecipient(null);
      setSearchUser('');
      setFoundUsers([]);
      refreshProfile();
      loadTransactions();
    } catch (error) {
      toast.error('Transfer failed');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="grid grid-cols-4 gap-3">
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDepositModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">UPI</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDepositModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-2">
                <QrCode className="w-6 h-6 text-secondary" />
              </div>
              <span className="text-xs font-medium text-foreground">QR Pay</span>
            </motion.button>
            
            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDepositModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <CreditCard className="w-6 h-6 text-accent" />
              </div>
              <span className="text-xs font-medium text-foreground">Card</span>
            </motion.button>

            <motion.button
              className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTransferModal(true)}
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-success/10 flex items-center justify-center mb-2">
                <Send className="w-6 h-6 text-success" />
              </div>
              <span className="text-xs font-medium text-foreground">Transfer</span>
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
        <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Money</DialogTitle>
            <DialogDescription>
              Deposit Rs1000+ at once to get Rs100 bonus + Blue Tick!
            </DialogDescription>
          </DialogHeader>

          <Tabs value={depositTab} onValueChange={(v) => setDepositTab(v as 'auto' | 'manual')} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger 
                value="auto" 
                className="rounded-lg"
                disabled={!paymentSettings?.automatic_payment?.is_enabled}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Automatic
              </TabsTrigger>
              <TabsTrigger value="manual" className="rounded-lg">
                <QrCode className="w-4 h-4 mr-2" />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Automatic Payment Tab */}
            <TabsContent value="auto" className="mt-4 space-y-4">
              {!paymentSettings?.automatic_payment?.is_enabled ? (
                <div className="p-4 bg-warning/10 rounded-xl flex items-center gap-3 text-warning">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">Automatic payment is currently unavailable. Please use manual deposit.</p>
                </div>
              ) : (
                <>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-14 text-2xl text-center font-bold rounded-xl"
                  />

                  <div className="flex flex-wrap gap-2">
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
                    className="w-full h-12 btn-gradient rounded-xl"
                    disabled={loading || !depositAmount}
                  >
                    {loading ? 'Processing...' : `Pay ₹${depositAmount || '0'}`}
                  </Button>
                </>
              )}
            </TabsContent>

            {/* Manual Payment Tab */}
            <TabsContent value="manual" className="mt-4 space-y-4">
              {/* Payment QR */}
              {paymentSettings?.manual_payment_qr?.setting_value && (
                <div className="flex flex-col items-center">
                  <img 
                    src={paymentSettings.manual_payment_qr.setting_value} 
                    alt="Payment QR" 
                    className="w-48 h-48 object-contain rounded-xl border"
                  />
                  <p className="text-sm text-muted-foreground mt-2">Scan QR to pay</p>
                </div>
              )}

              {/* Payment Link */}
              {paymentSettings?.manual_payment_link?.setting_value && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <a 
                    href={paymentSettings.manual_payment_link.setting_value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary truncate flex-1"
                  >
                    {paymentSettings.manual_payment_link.setting_value}
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(paymentSettings.manual_payment_link.setting_value!)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Instructions */}
              {paymentSettings?.manual_payment_instructions?.setting_value && (
                <div className="p-3 bg-primary/5 rounded-xl text-sm text-foreground">
                  {paymentSettings.manual_payment_instructions.setting_value}
                </div>
              )}

              <div className="space-y-3">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-14 text-2xl text-center font-bold rounded-xl"
                />

                <div className="flex flex-wrap gap-2">
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

                <Input
                  placeholder="Enter Transaction ID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="rounded-xl"
                />

                <Button
                  onClick={handleManualDeposit}
                  className="w-full h-12 btn-gradient rounded-xl"
                  disabled={submittingManual || !depositAmount || !transactionId}
                >
                  {submittingManual ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    `Submit Request ₹${depositAmount || '0'}`
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your deposit will be credited after admin verification
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Send Money</DialogTitle>
            <DialogDescription>
              Transfer money to another user instantly
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {!selectedRecipient ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or referral code"
                    value={searchUser}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>

                {searchingUsers ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Searching...
                  </div>
                ) : foundUsers.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {foundUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedRecipient(u)}
                        className="w-full flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{u.referral_code}</span>
                      </button>
                    ))}
                  </div>
                ) : searchUser.length >= 2 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Enter at least 2 characters to search
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                    {selectedRecipient.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{selectedRecipient.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRecipient.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedRecipient(null)}
                  >
                    Change
                  </Button>
                </div>

                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="h-14 text-2xl text-center font-bold rounded-xl"
                />

                <Input
                  placeholder="Add a note (optional)"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="rounded-xl"
                />

                <div className="text-center text-sm text-muted-foreground">
                  Your balance: ₹{profile?.wallet_balance?.toFixed(2) || '0.00'}
                </div>

                <Button
                  onClick={handleTransfer}
                  className="w-full h-12 btn-gradient rounded-xl"
                  disabled={loading || !transferAmount || parseFloat(transferAmount) <= 0}
                >
                  {loading ? 'Sending...' : `Send ₹${transferAmount || '0'}`}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type={successData.type}
        title={successData.title}
        message={successData.message}
        details={successData.details}
        actionLabel="View Wallet"
        autoCloseDelay={4000}
      />

      <BottomNav />
    </div>
  );
};

export default WalletPage;
