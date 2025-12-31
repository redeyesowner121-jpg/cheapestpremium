import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Gift, ShoppingBag, Wallet, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'order' | 'bonus' | 'deposit' | 'achievement';
  title: string;
  message: string;
  details?: {
    label: string;
    value: string;
  }[];
  actionLabel?: string;
  onAction?: () => void;
  autoCloseDelay?: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
  actionLabel = 'Continue',
  onAction,
  autoCloseDelay = 3000
}) => {
  useEffect(() => {
    if (isOpen && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        onClose();
        onAction?.();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseDelay, onClose, onAction]);

  const getIcon = () => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-10 h-10 text-white" strokeWidth={2} />;
      case 'bonus':
        return <Gift className="w-10 h-10 text-white" strokeWidth={2} />;
      case 'deposit':
        return <Wallet className="w-10 h-10 text-white" strokeWidth={2} />;
      case 'achievement':
        return <Trophy className="w-10 h-10 text-white" strokeWidth={2} />;
      default:
        return <Check className="w-10 h-10 text-white" strokeWidth={3} />;
    }
  };

  const getGradient = () => {
    switch (type) {
      case 'order':
        return 'from-green-400 to-green-600';
      case 'bonus':
        return 'from-amber-400 to-orange-500';
      case 'deposit':
        return 'from-blue-400 to-blue-600';
      case 'achievement':
        return 'from-purple-400 to-purple-600';
      default:
        return 'from-green-400 to-green-600';
    }
  };

  const confettiColors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
          >
            {/* Animated Background Glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.3, scale: 1.5 }}
              transition={{ duration: 0.6 }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-br ${getGradient()} blur-3xl`}
            />

            {/* Success Icon Animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={`w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br ${getGradient()} flex items-center justify-center shadow-lg relative z-10`}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                {getIcon()}
              </motion.div>
              
              {/* Ripple Effect */}
              <motion.div
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.8, repeat: 2 }}
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${getGradient()}`}
              />
            </motion.div>

            {/* Check Mark Ring Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[65%] w-24 h-24 rounded-full border-4 border-dashed border-primary/30"
            />

            {/* Success Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="relative z-10"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {title}
              </h2>
              <p className="text-muted-foreground mb-4">
                {message}
              </p>
            </motion.div>

            {/* Details */}
            {details && details.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-muted/50 rounded-xl p-4 mb-6 relative z-10"
              >
                {details.map((detail, index) => (
                  <div key={index} className={`flex justify-between items-center ${index > 0 ? 'mt-2 pt-2 border-t border-border' : ''}`}>
                    <span className="text-sm text-muted-foreground">{detail.label}</span>
                    <span className="font-bold text-primary">{detail.value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Confetti Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    y: "100%", 
                    x: `${Math.random() * 100}%`,
                    scale: 0,
                    rotate: 0
                  }}
                  animate={{ 
                    y: `${Math.random() * -100}%`,
                    x: `${(Math.random() - 0.5) * 200}%`,
                    scale: [0, 1, 0.5],
                    rotate: Math.random() * 360
                  }}
                  transition={{ 
                    delay: 0.3 + i * 0.03,
                    duration: 1.5,
                    ease: "easeOut"
                  }}
                  className="absolute bottom-0 w-3 h-3"
                  style={{
                    left: `${(i / 20) * 100}%`,
                    backgroundColor: confettiColors[i % confettiColors.length],
                    borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0'
                  }}
                />
              ))}
            </div>

            {/* Stars Animation */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`star-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0]
                }}
                transition={{ 
                  delay: 0.6 + i * 0.1,
                  duration: 0.8,
                  ease: "easeOut"
                }}
                className="absolute text-yellow-400"
                style={{
                  top: `${20 + Math.random() * 60}%`,
                  left: `${10 + Math.random() * 80}%`,
                  fontSize: `${12 + Math.random() * 12}px`
                }}
              >
                ✨
              </motion.div>
            ))}

            {/* Action Button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="relative z-10"
            >
              <Button 
                onClick={() => {
                  onClose();
                  onAction?.();
                }}
                className="w-full btn-gradient rounded-xl"
              >
                {actionLabel}
              </Button>
              {autoCloseDelay > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Auto-closing in {Math.ceil(autoCloseDelay / 1000)} seconds...
                </p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessModal;
