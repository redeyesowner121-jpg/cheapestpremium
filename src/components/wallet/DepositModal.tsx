import React, { useState } from 'react';
import { Smartphone, Bitcoin, MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { type DepositModalProps } from './deposit/constants';
import { BinancePayScreen } from './deposit/ForeignScreens';
import { ContactSellerFlow } from './deposit/ContactSellerFlow';
import IndiaPaymentScreen from './deposit/IndiaPaymentScreen';

type DepositMethod = null | 'upi' | 'binance' | 'contact';

const DepositModal: React.FC<DepositModalProps> = (props) => {
  const {
    open, onOpenChange, depositAmount, onDepositAmountChange,
    paymentSettings, loading, onAutoDeposit, onManualDeposit,
    submittingManual, transactionId, onTransactionIdChange,
    senderName, onSenderNameChange, initialTab
  } = props;

  const [method, setMethod] = useState<DepositMethod>(null);
  const [depositTab, setDepositTab] = useState<'auto' | 'manual'>(initialTab === 'manual' ? 'manual' : 'auto');

  React.useEffect(() => {
    if (open && initialTab) {
      setDepositTab(initialTab === 'manual' ? 'manual' : 'auto');
    }
    if (!open) {
      setMethod(null);
    }
  }, [open, initialTab]);

  // Method selection screen
  if (!method) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>💰 Add Money</DialogTitle>
            <DialogDescription>Choose your preferred payment method</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <button
              onClick={() => setMethod('upi')}
              className="w-full p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-4 hover:bg-blue-500/20 transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">UPI Payment</p>
                <p className="text-xs text-muted-foreground">Automatic & Manual options</p>
              </div>
              <span className="text-2xl">🇮🇳</span>
            </button>

            <button
              onClick={() => setMethod('binance')}
              className="w-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-4 hover:bg-amber-500/20 transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-amber-600">₿</span>
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">Binance Pay</p>
                <p className="text-xs text-muted-foreground">Automatic & Manual options</p>
              </div>
              <span className="text-2xl">💎</span>
            </button>

            <button
              onClick={() => setMethod('contact')}
              className="w-full p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center gap-4 hover:bg-green-500/20 transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">I don't have Binance</p>
                <p className="text-xs text-muted-foreground">Contact seller for alternatives</p>
              </div>
              <span className="text-2xl">📞</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // UPI flow
  if (method === 'upi') {
    return (
      <IndiaPaymentScreen
        open={open}
        onOpenChange={onOpenChange}
        depositAmount={depositAmount}
        onDepositAmountChange={onDepositAmountChange}
        paymentSettings={paymentSettings}
        loading={loading}
        onAutoDeposit={onAutoDeposit}
        onManualDeposit={onManualDeposit}
        submittingManual={submittingManual}
        transactionId={transactionId}
        onTransactionIdChange={onTransactionIdChange}
        senderName={senderName}
        onSenderNameChange={onSenderNameChange}
        depositTab={depositTab}
        onTabChange={setDepositTab}
        onChangeCountry={() => setMethod(null)}
      />
    );
  }

  // Binance flow
  if (method === 'binance') {
    return (
      <BinancePayScreen
        open={open}
        onOpenChange={onOpenChange}
        depositAmount={depositAmount}
        onDepositAmountChange={onDepositAmountChange}
        senderName={senderName}
        onSenderNameChange={onSenderNameChange}
        transactionId={transactionId}
        onTransactionIdChange={onTransactionIdChange}
        onManualDeposit={onManualDeposit}
        submittingManual={submittingManual}
        onBack={() => setMethod(null)}
      />
    );
  }

  // Contact seller flow
  return (
    <ContactSellerFlow
      open={open}
      onOpenChange={onOpenChange}
      onBack={() => setMethod(null)}
    />
  );
};

export default DepositModal;
