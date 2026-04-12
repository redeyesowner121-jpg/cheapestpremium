import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';

export interface Transaction {
  id: string; type: string; amount: number; status: string; description: string; created_at: string;
}

export interface PaymentSettings {
  automatic_payment: { is_enabled: boolean };
  manual_payment_qr: { setting_value: string | null; is_enabled: boolean };
  manual_payment_link: { setting_value: string | null; is_enabled: boolean };
  manual_payment_instructions: { setting_value: string | null };
  upi_id: { setting_value: string | null; is_enabled: boolean };
  upi_name: { setting_value: string | null; is_enabled: boolean };
}

declare global {
  interface Window { Razorpay: any; }
}

export const useWalletData = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { settings } = useAppSettingsContext();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [successData, setSuccessData] = useState<any>({ type: 'deposit', title: '', message: '', details: [] });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
      const s: any = {};
      data.forEach(item => { s[item.setting_key] = { setting_value: item.setting_value, is_enabled: item.is_enabled }; });
      setPaymentSettings(s);
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
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay-webhook', {
            body: { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, userId: user.id, amount }
          });
          if (verifyError || !verifyData?.success) { toast.error('Payment verification failed'); return; }
          const details: any[] = [{ label: 'Amount Added', value: `₹${amount}` }];
          if (verifyData.bonusAmount > 0) details.push({ label: 'Bonus Earned', value: `₹${verifyData.bonusAmount}` });
          if (verifyData.gotBlueTick) details.push({ label: 'Special Reward', value: '✓ Blue Tick Unlocked!' });
          setSuccessData({ type: verifyData.bonusAmount > 0 ? 'bonus' : 'deposit', title: verifyData.bonusAmount > 0 ? 'Bonus Claimed! 🎉' : 'Deposit Successful!', message: verifyData.bonusAmount > 0 ? 'Congratulations! You earned bonus money!' : 'Your wallet has been credited successfully', details });
          refreshProfile(); loadTransactions(); setShowSuccessModal(true); setDepositAmount('');
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
      setHasPendingRequest(true); setDepositAmount(''); setTransactionId(''); setSenderName('');
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
      const { data, error } = await supabase.rpc('transfer_funds', {
        _sender_id: user.id,
        _receiver_id: recipient.id,
        _amount: amt,
        _note: note || null,
      });
      if (error) throw new Error(error.message);
      toast.success(`₹${amt} sent to ${recipient.name}`);
      refreshProfile(); loadTransactions();
    } catch (err: any) { toast.error(err.message || 'Transfer failed'); }
    finally { setLoading(false); }
  };

  const handleRedeemCode = async () => {
    if (!user || !profile) return;
    const code = redeemCode.trim().toUpperCase();
    if (!code) { toast.error('Please enter a code'); return; }
    setRedeemingCode(true);
    try {
      const { data, error } = await supabase.rpc('redeem_gift_code', {
        _user_id: user.id,
        _code: code,
      });
      if (error) throw new Error(error.message);
      const result = data as any;
      setSuccessData({ type: 'bonus', title: 'Code Redeemed! 🎉', message: result.description || 'Gift code successfully redeemed!', details: [{ label: 'Amount Added', value: `₹${result.amount}` }, { label: 'New Balance', value: `₹${Number(result.new_balance).toFixed(2)}` }] });
      refreshProfile(); loadTransactions(); setRedeemCode(''); setShowSuccessModal(true);
    } catch (err: any) { toast.error(err.message || 'Failed to redeem code'); }
    finally { setRedeemingCode(false); }
  };

  useEffect(() => {
    if (user) {
      loadTransactions();
      loadPaymentSettings();
      checkPendingRequests();
    }
  }, [user]);

  return {
    transactions, paymentSettings, hasPendingRequest, loading,
    depositAmount, setDepositAmount, transactionId, setTransactionId,
    senderName, setSenderName, submittingManual,
    redeemCode, setRedeemCode, redeemingCode,
    successData, showSuccessModal, setShowSuccessModal,
    handleDeposit, handleManualDeposit, handleTransfer, handleRedeemCode,
    loadTransactions,
  };
};
