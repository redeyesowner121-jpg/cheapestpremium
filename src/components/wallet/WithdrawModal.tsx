import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Smartphone, Wallet, ArrowDownToLine, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { motion, AnimatePresence } from 'framer-motion';

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  walletBalance: number;
  onSuccess: () => void;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({
  open, onOpenChange, userId, walletBalance, onSuccess
}) => {
  const { settings } = useAppSettingsContext();
  const [method, setMethod] = useState<'upi' | 'binance'>('upi');
  const [amount, setAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('request');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const minWithdraw = 50;

  useEffect(() => {
    if (open && activeTab === 'history') {
      loadHistory();
    }
  }, [open, activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data || []);
    setLoadingHistory(false);
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < minWithdraw) {
      toast.error(`Minimum withdrawal is ${settings.currency_symbol}${minWithdraw}`);
      return;
    }
    if (amt > walletBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!accountDetails.trim()) {
      toast.error(method === 'upi' ? 'Please enter your UPI ID' : 'Please enter your Binance Pay ID');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('withdrawal_requests').insert({
        user_id: userId,
        amount: amt,
        method,
        account_details: accountDetails.trim(),
        status: 'pending',
      });
      if (error) throw error;

      toast.success('Withdrawal request submitted! Admin will process it soon.');
      setAmount('');
      setAccountDetails('');
      onSuccess();
      setActiveTab('history');
      loadHistory();
    } catch {
      toast.error('Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
      pending: { icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-warning/10 text-warning', label: 'Pending' },
      approved: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-success/10 text-success', label: 'Approved' },
      rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'bg-destructive/10 text-destructive', label: 'Rejected' },
      processing: { icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-primary/10 text-primary', label: 'Processing' },
    };
    const c = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}>
        {c.icon}{c.label}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            Withdraw Funds
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none bg-muted/50 px-6">
            <TabsTrigger value="request" className="flex-1 text-sm">New Request</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-sm">History</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="p-6 pt-4 space-y-5">
            {/* Balance Display */}
            <div className="text-center py-3 bg-muted/30 rounded-2xl">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-foreground">{settings.currency_symbol}{walletBalance.toFixed(2)}</p>
            </div>

            {/* Method Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMethod('upi')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-colors ${
                    method === 'upi' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <Smartphone className={`w-5 h-5 ${method === 'upi' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${method === 'upi' ? 'text-primary' : 'text-muted-foreground'}`}>UPI</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMethod('binance')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-colors ${
                    method === 'binance' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <Wallet className={`w-5 h-5 ${method === 'binance' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${method === 'binance' ? 'text-primary' : 'text-muted-foreground'}`}>Binance</span>
                </motion.button>
              </div>
            </div>

            {/* Account Details */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {method === 'upi' ? 'Your UPI ID' : 'Your Binance Pay ID'}
              </Label>
              <Input
                placeholder={method === 'upi' ? 'example@paytm' : '123456789'}
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Amount ({settings.currency_symbol})</Label>
              <Input
                type="number"
                placeholder={`Min ${settings.currency_symbol}${minWithdraw}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl h-11"
              />
              <div className="flex gap-2">
                {[100, 500, 1000, 2000].map(val => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(Math.min(val, walletBalance)))}
                    className="flex-1 text-xs py-1.5 bg-muted hover:bg-muted/80 rounded-lg font-medium transition-colors"
                  >
                    {settings.currency_symbol}{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-accent/5 border border-accent/20 rounded-xl text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>Withdrawals are processed within 24 hours. Min: {settings.currency_symbol}{minWithdraw}. Amount will be deducted after admin approval.</span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-xl btn-gradient"
            >
              {submitting ? 'Submitting...' : 'Submit Withdrawal Request'}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="p-6 pt-4">
            <AnimatePresence mode="wait">
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowDownToLine className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {history.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                    >
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          {settings.currency_symbol}{req.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.method.toUpperCase()} • {new Date(req.created_at).toLocaleDateString()}
                        </p>
                        {req.admin_note && req.status === 'rejected' && (
                          <p className="text-xs text-destructive mt-0.5">Note: {req.admin_note}</p>
                        )}
                      </div>
                      {getStatusBadge(req.status)}
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawModal;
