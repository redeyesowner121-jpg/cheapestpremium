import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Minus, CreditCard, Smartphone, QrCode,
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle,
  Gift, TrendingUp, Send, Wallet, LogIn, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SuccessModal from '@/components/SuccessModal';
import DepositModal from '@/components/wallet/DepositModal';
import TransferModal from '@/components/wallet/TransferModal';
import RedeemModal from '@/components/wallet/RedeemModal';
import CurrencyConverter from '@/components/wallet/CurrencyConverter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import appLogo from '@/assets/app-logo.jpg';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

declare global {
  interface Window { Razorpay: any; }
}

interface Transaction {
  id: string; type: string; amount: number; status: string; description: string; created_at: string;
}

interface PaymentSettings {
  automatic_payment: { is_enabled: boolean };
  manual_payment_qr: { setting_value: string | null; is_enabled: boolean };
  manual_payment_link: { setting_value: string | null; is_enabled: boolean };
  manual_payment_instructions: { setting_value: string | null };
  upi_id: { setting_value: string | null; is_enabled: boolean };
  upi_name: { setting_value: string | null; is_enabled: boolean };
}

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositInitialTab, setDepositInitialTab] = useState<'auto' | 'manual' | 'card'>('card');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<any>({ type: 'deposit', title: '', message: '', details: [] });
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const { formatPrice: formatBalance, displayCurrency } = useCurrencyFormat();
  const { settings } = useAppSettingsContext();

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <Header />
        <main className="pt-20 px-4 max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <motion.div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <Wallet className="w-10 h-10 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Wallet</h2>
            <p className="text-muted-foreground mb-8">Login to access your wallet, deposit money, and manage transfers</p>
            <Button className="w-full h-12 btn-gradient rounded-xl" onClick={() => navigate('/auth')}>
              <LogIn className="w-5 h-5 mr-2" />Login to Continue
            </Button>
            <p className="text-sm text-muted-foreground mt-6">Guest checkout available on product pages</p>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const checkPendingRequests = async () => {
    if (!user) return;
    const { data } = await supabase.from('manual_deposit_requests').select('id').eq('user_id', user.id).eq('status', 'pending').limit(1);
    setHasPendingRequest((data?.length || 0) > 0);
  };

  const loadTransactions = async () => {
    if (!user) return;
    const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (data) setTransactions(data);
  };

  const loadPaymentSettings = async () => {
    const { data } = await supabase.from('payment_settings').select('*');
    if (data) {
      const settings: any = {};
      data.forEach(s => { settings[s.setting_key] = { setting_value: s.setting_value, is_enabled: s.is_enabled }; });
      setPaymentSettings(settings);
    }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleDeposit = async () => {
    if (!user || !profile) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < (settings.min_deposit || 10)) { toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`); return; }
    setLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) { toast.error('Failed to load payment gateway'); setLoading(false); return; }
      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay-order', { body: { amount, userId: user.id } });
      if (orderError || !orderData) { toast.error('Failed to create payment order'); setLoading(false); return; }

      const options = {
        key: orderData.keyId, amount: orderData.amount, currency: orderData.currency,
        name: 'RKR Premium Store', description: `Wallet Deposit - Rs ${amount}`, order_id: orderData.orderId,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay-verify', {
            body: { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, userId: user.id, amount }
          });
          if (verifyError || !verifyData?.success) { toast.error('Payment verification failed'); return; }
          const details: any[] = [{ label: 'Amount Added', value: `₹${amount}` }];
          if (verifyData.bonusAmount > 0) details.push({ label: 'Bonus Earned', value: `₹${verifyData.bonusAmount}` });
          if (verifyData.gotBlueTick) details.push({ label: 'Special Reward', value: '✓ Blue Tick Unlocked!' });
          setSuccessData({ type: verifyData.bonusAmount > 0 ? 'bonus' : 'deposit', title: verifyData.bonusAmount > 0 ? 'Bonus Claimed! 🎉' : 'Deposit Successful!', message: verifyData.bonusAmount > 0 ? 'Congratulations! You earned bonus money!' : 'Your wallet has been credited successfully', details });
          refreshProfile(); loadTransactions(); setShowDepositModal(false); setDepositAmount(''); setShowSuccessModal(true);
        },
        prefill: { email: profile.email, contact: profile.phone || '' },
        theme: { color: '#4f46e5' }
      };
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) { toast.error(error.message || 'Deposit failed'); }
    finally { setLoading(false); }
  };

  const handleManualDeposit = async () => {
    if (!user || !profile) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount < (settings.min_deposit || 10)) { toast.error(`Minimum deposit is ₹${settings.min_deposit || 10}`); return; }
    if (!transactionId.trim()) { toast.error('Please enter Transaction ID'); return; }
    if (!senderName.trim()) { toast.error('Please enter your name'); return; }
    setSubmittingManual(true);
    try {
      const { error } = await supabase.from('manual_deposit_requests').insert({ user_id: user.id, amount, transaction_id: transactionId.trim(), sender_name: senderName.trim(), payment_method: 'qr', status: 'pending' });
      if (error) throw error;
      toast.success('Deposit request submitted! Waiting for admin approval.');
      setHasPendingRequest(true); setShowDepositModal(false); setDepositAmount(''); setTransactionId(''); setSenderName('');
    } catch { toast.error('Failed to submit request'); }
    finally { setSubmittingManual(false); }
  };

  const handleTransfer = async (recipient: any, amount: string, note: string) => {
    if (!user || !profile) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Please enter a valid amount'); return; }
    if (amt > (profile.wallet_balance || 0)) { toast.error('Insufficient balance'); return; }
    setLoading(true);
    try {
      const { data: senderData } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      const { data: recipientData } = await supabase.from('profiles').select('wallet_balance').eq('id', recipient.id).single();
      if (!senderData || (senderData.wallet_balance || 0) < amt) { toast.error('Insufficient balance'); setLoading(false); return; }
      await supabase.from('profiles').update({ wallet_balance: (senderData.wallet_balance || 0) - amt }).eq('id', user.id);
      await supabase.from('profiles').update({ wallet_balance: (recipientData?.wallet_balance || 0) + amt }).eq('id', recipient.id);
      await supabase.from('transactions').insert([
        { user_id: user.id, type: 'transfer_out', amount: -amt, status: 'completed', description: `Transfer to ${recipient.name}` },
        { user_id: recipient.id, type: 'transfer_in', amount: amt, status: 'completed', description: `Transfer from ${profile.name}` }
      ]);
      await supabase.from('notifications').insert({ user_id: recipient.id, title: 'Money Received! 💰', message: `You received ₹${amt} from ${profile.name}${note ? ` - "${note}"` : ''}`, type: 'wallet' });
      toast.success(`₹${amt} sent to ${recipient.name}`);
      setShowTransferModal(false); refreshProfile(); loadTransactions();
    } catch { toast.error('Transfer failed'); }
    finally { setLoading(false); }
  };

  const handleRedeemCode = async () => {
    if (!user || !profile) return;
    const code = redeemCode.trim().toUpperCase();
    if (!code) { toast.error('Please enter a code'); return; }
    setRedeemingCode(true);
    try {
      const { data: codeData, error: codeError } = await supabase.from('redeem_codes').select('*').eq('code', code).eq('is_active', true).single();
      if (codeError || !codeData) { toast.error('Invalid or inactive code'); return; }
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) { toast.error('This code has expired'); return; }
      if (codeData.used_count >= codeData.usage_limit) { toast.error('This code has reached its usage limit'); return; }
      const { data: usageData } = await supabase.from('redeem_code_usage').select('id').eq('code_id', codeData.id).eq('user_id', user.id).single();
      if (usageData) { toast.error('You have already used this code'); return; }
      const newBalance = (profile.wallet_balance || 0) + codeData.amount;
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', user.id);
      await supabase.from('redeem_code_usage').insert({ code_id: codeData.id, user_id: user.id });
      await supabase.from('redeem_codes').update({ used_count: codeData.used_count + 1 }).eq('id', codeData.id);
      await supabase.from('transactions').insert({ user_id: user.id, type: 'gift', amount: codeData.amount, status: 'completed', description: `Redeemed code: ${code}` });
      setSuccessData({ type: 'bonus', title: 'Code Redeemed! 🎉', message: codeData.description || 'Gift code successfully redeemed!', details: [{ label: 'Amount Added', value: `₹${codeData.amount}` }, { label: 'New Balance', value: `₹${newBalance.toFixed(2)}` }] });
      refreshProfile(); loadTransactions(); setShowRedeemModal(false); setRedeemCode(''); setShowSuccessModal(true);
    } catch { toast.error('Failed to redeem code'); }
    finally { setRedeemingCode(false); }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'withdraw': case 'transfer_out': return <ArrowUpRight className="w-5 h-5 text-destructive" />;
      case 'purchase': return <CreditCard className="w-5 h-5 text-primary" />;
      case 'refund': case 'transfer_in': return <ArrowDownLeft className="w-5 h-5 text-success" />;
      case 'bonus': case 'gift': return <Gift className="w-5 h-5 text-accent" />;
      case 'referral': return <TrendingUp className="w-5 h-5 text-secondary" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'pending': return <Clock className="w-4 h-4 text-accent" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Balance Card */}
        <div className="gradient-primary rounded-3xl p-6 text-center shadow-glow">
          <div className="flex items-center justify-center gap-2">
            <p className="text-primary-foreground/80 text-sm">Available Balance {displayCurrency && displayCurrency.code !== 'INR' ? `(${displayCurrency.code})` : ''}</p>
            <button
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-primary-foreground text-xs px-2.5 py-1 rounded-full transition-colors"
            >
              <ArrowDownLeft className="w-3 h-3" />
              Convert
            </button>
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground mt-2">{formatBalance(profile?.wallet_balance || 0)}</h1>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-primary-foreground/60 text-xs">Total Deposit</p>
              <p className="text-primary-foreground font-semibold">{formatBalance(profile?.total_deposit || 0)}</p>
            </div>
            <div className="w-px h-10 bg-primary-foreground/20" />
            <div className="text-center">
              <p className="text-primary-foreground/60 text-xs">Total Spent</p>
              <p className="text-primary-foreground font-semibold">
                {formatBalance(transactions.filter(t => t.type === 'purchase' && t.status === 'completed').reduce((sum, t) => sum + Math.abs(t.amount), 0))}
              </p>
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <Button onClick={() => { setDepositInitialTab('card'); setShowDepositModal(true); }} className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-primary-foreground rounded-xl">
              <Plus className="w-5 h-5 mr-2" />Add Money
            </Button>
            <Button variant="outline" className="flex-1 h-12 border-white/30 text-primary-foreground hover:bg-white/10 rounded-xl"
              onClick={() => toast.info('Withdrawal feature coming soon! Contact admin for withdrawals.')}>
              <Minus className="w-5 h-5 mr-2" />Withdraw
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-3">
            <button className={`bg-card rounded-2xl p-4 shadow-card text-center active:scale-95 transition-transform relative ${hasPendingRequest ? 'ring-2 ring-accent' : ''}`}
              onClick={() => { setDepositInitialTab('auto'); setShowDepositModal(true); }}>
              {hasPendingRequest && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />}
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2"><Smartphone className="w-6 h-6 text-primary" /></div>
              <span className="text-xs font-medium text-foreground">UPI</span>
            </button>
            <button className="bg-card rounded-2xl p-4 shadow-card text-center active:scale-95 transition-transform" onClick={() => { setDepositInitialTab('manual'); setShowDepositModal(true); }}>
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-2"><QrCode className="w-6 h-6 text-secondary" /></div>
              <span className="text-xs font-medium text-foreground">QR Pay</span>
            </button>
            <button className="bg-card rounded-2xl p-4 shadow-card text-center active:scale-95 transition-transform" onClick={() => { setDepositInitialTab('card'); setShowDepositModal(true); }}>
              <div className="w-12 h-12 mx-auto rounded-xl bg-accent/10 flex items-center justify-center mb-2"><CreditCard className="w-6 h-6 text-accent" /></div>
              <span className="text-xs font-medium text-foreground">Card</span>
            </button>
            <button className="bg-card rounded-2xl p-4 shadow-card text-center active:scale-95 transition-transform" onClick={() => setShowTransferModal(true)}>
              <div className="w-12 h-12 mx-auto rounded-xl bg-success/10 flex items-center justify-center mb-2"><Send className="w-6 h-6 text-success" /></div>
              <span className="text-xs font-medium text-foreground">Transfer</span>
            </button>
          </div>
          <button onClick={() => setShowRedeemModal(true)}
            className="w-full mt-4 bg-accent/10 border border-accent/30 rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform">
            <Gift className="w-6 h-6 text-accent" /><span className="font-semibold text-accent">Redeem Gift Code</span>
          </button>
        </div>

        {/* Currency Converter Modal */}
        <CurrencyConverter
          open={showConvertModal}
          onOpenChange={setShowConvertModal}
          walletBalance={profile?.wallet_balance || 0}
          onConverted={() => window.location.reload()}
        />

        {/* Transactions */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Recent Transactions</h2>
            <button className="text-sm text-primary font-medium" onClick={() => navigate('/wallet/transactions')}>See All</button>
          </div>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No transactions yet</div>
            ) : transactions.map((txn) => (
              <div key={txn.id} className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4">
                <div className="p-2 rounded-xl bg-muted">{getTransactionIcon(txn.type)}</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{txn.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(txn.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${['purchase', 'withdraw', 'transfer_out'].includes(txn.type) ? 'text-destructive' : 'text-success'}`}>
                    {['purchase', 'withdraw', 'transfer_out'].includes(txn.type) ? '-' : '+'}₹{Math.abs(txn.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {getStatusIcon(txn.status)}
                    <span className="text-xs text-muted-foreground capitalize">{txn.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal}
        depositAmount={depositAmount} onDepositAmountChange={setDepositAmount}
        paymentSettings={paymentSettings} loading={loading}
        onAutoDeposit={handleDeposit} onManualDeposit={handleManualDeposit}
        submittingManual={submittingManual}
        transactionId={transactionId} onTransactionIdChange={setTransactionId}
        senderName={senderName} onSenderNameChange={setSenderName}
        initialTab={depositInitialTab}
      />

      <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal}
        userId={user.id} walletBalance={profile?.wallet_balance || 0}
        loading={loading} onTransfer={handleTransfer}
      />

      <RedeemModal open={showRedeemModal} onOpenChange={setShowRedeemModal}
        redeemCode={redeemCode} onRedeemCodeChange={setRedeemCode}
        redeeming={redeemingCode} onRedeem={handleRedeemCode}
      />

      <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)}
        type={successData.type} title={successData.title} message={successData.message}
        details={successData.details} actionLabel="View Wallet" autoCloseDelay={4000}
      />

      <BottomNav />
    </div>
  );
};

export default WalletPage;
