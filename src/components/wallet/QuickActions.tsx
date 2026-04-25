import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, QrCode, Bitcoin, Send } from 'lucide-react';

interface QuickActionsProps {
  hasPendingRequest: boolean;
  onUpi: () => void;
  onQr: () => void;
  onCrypto: () => void;
  onTransfer: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  hasPendingRequest,
  onUpi,
  onQr,
  onCrypto,
  onTransfer
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6"
    >
      <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
      <div className="grid grid-cols-4 gap-3">
        <motion.button
          className={`bg-card rounded-2xl p-4 shadow-card text-center card-hover relative ${hasPendingRequest ? 'ring-2 ring-accent' : ''}`}
          whileTap={{ scale: 0.95 }}
          onClick={onDeposit}
        >
          {hasPendingRequest && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
          )}
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">UPI</span>
        </motion.button>
        
        <motion.button
          className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
          whileTap={{ scale: 0.95 }}
          onClick={onDeposit}
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/10 flex items-center justify-center mb-2">
            <QrCode className="w-6 h-6 text-secondary" />
          </div>
          <span className="text-xs font-medium text-foreground">QR Pay</span>
        </motion.button>
        
        <motion.button
          className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
          whileTap={{ scale: 0.95 }}
          onClick={onDeposit}
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-accent/10 flex items-center justify-center mb-2">
            <CreditCard className="w-6 h-6 text-accent" />
          </div>
          <span className="text-xs font-medium text-foreground">Card</span>
        </motion.button>

        <motion.button
          className="bg-card rounded-2xl p-4 shadow-card text-center card-hover"
          whileTap={{ scale: 0.95 }}
          onClick={onTransfer}
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-success/10 flex items-center justify-center mb-2">
            <Send className="w-6 h-6 text-success" />
          </div>
          <span className="text-xs font-medium text-foreground">Transfer</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default QuickActions;