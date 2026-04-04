import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, LogIn, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SuccessModal from '@/components/SuccessModal';
import DepositModal from '@/components/wallet/DepositModal';
import TransferModal from '@/components/wallet/TransferModal';
import RedeemModal from '@/components/wallet/RedeemModal';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import CurrencyConverter from '@/components/wallet/CurrencyConverter';
import WalletBalanceCard from '@/components/wallet/WalletBalanceCard';
import QuickActions from '@/components/wallet/QuickActions';
import TransactionList from '@/components/wallet/TransactionList';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useWalletData } from '@/hooks/useWalletData';

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const wallet = useWalletData();

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositInitialTab, setDepositInitialTab] = useState<'auto' | 'manual' | 'card'>('card');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <WalletBalanceCard
          walletBalance={profile?.wallet_balance || 0}
          totalDeposit={profile?.total_deposit || 0}
          onAddMoney={() => { setDepositInitialTab('card'); setShowDepositModal(true); }}
          onWithdraw={() => setShowWithdrawModal(true)}
        />

        <QuickActions
          hasPendingRequest={wallet.hasPendingRequest}
          onDeposit={() => { setDepositInitialTab('auto'); setShowDepositModal(true); }}
          onTransfer={() => setShowTransferModal(true)}
        />

        <button onClick={() => setShowRedeemModal(true)}
          className="w-full mt-4 bg-accent/10 border border-accent/30 rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform">
          <Gift className="w-6 h-6 text-accent" /><span className="font-semibold text-accent">Redeem Gift Code</span>
        </button>

        <CurrencyConverter
          open={showConvertModal}
          onOpenChange={setShowConvertModal}
          walletBalance={profile?.wallet_balance || 0}
          onConverted={() => window.location.reload()}
        />

        <TransactionList transactions={wallet.transactions} />
      </main>

      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal}
        depositAmount={wallet.depositAmount} onDepositAmountChange={wallet.setDepositAmount}
        paymentSettings={wallet.paymentSettings} loading={wallet.loading}
        onAutoDeposit={() => { wallet.handleDeposit(); }}
        onManualDeposit={() => { wallet.handleManualDeposit(); }}
        submittingManual={wallet.submittingManual}
        transactionId={wallet.transactionId} onTransactionIdChange={wallet.setTransactionId}
        senderName={wallet.senderName} onSenderNameChange={wallet.setSenderName}
        initialTab={depositInitialTab}
      />

      <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal}
        userId={user.id} walletBalance={profile?.wallet_balance || 0}
        loading={wallet.loading} onTransfer={(r, a, n) => { wallet.handleTransfer(r, a, n); setShowTransferModal(false); }}
      />

      <RedeemModal open={showRedeemModal} onOpenChange={setShowRedeemModal}
        redeemCode={wallet.redeemCode} onRedeemCodeChange={wallet.setRedeemCode}
        redeeming={wallet.redeemingCode} onRedeem={() => { wallet.handleRedeemCode(); setShowRedeemModal(false); }}
      />

      <WithdrawModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        userId={user.id}
        walletBalance={profile?.wallet_balance || 0}
        onSuccess={() => { wallet.loadTransactions(); }}
      />

      <SuccessModal isOpen={wallet.showSuccessModal} onClose={() => wallet.setShowSuccessModal(false)}
        type={wallet.successData.type} title={wallet.successData.title} message={wallet.successData.message}
        details={wallet.successData.details} actionLabel="View Wallet" autoCloseDelay={4000}
      />

      <BottomNav />
    </div>
  );
};

export default WalletPage;
