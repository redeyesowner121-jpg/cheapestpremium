import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Package, Truck, CreditCard, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SuccessType = 'order_placed' | 'order_confirmed' | 'order_delivered' | 'payment_success' | 'bonus_claimed';

interface AnimatedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: SuccessType;
  title?: string;
  subtitle?: string;
  details?: { label: string; value: string }[];
  actionLabel?: string;
  onAction?: () => void;
  autoCloseDelay?: number;
}

const config: Record<SuccessType, { icon: React.ReactNode; title: string; subtitle: string; colors: string[]; gradient: string }> = {
  order_placed: {
    icon: <Package className="w-10 h-10 text-white" strokeWidth={2.5} />,
    title: 'Order Placed!',
    subtitle: 'Your order has been successfully placed.',
    colors: ['#22c55e', '#16a34a', '#15803d'],
    gradient: 'from-green-400 via-green-500 to-green-600',
  },
  order_confirmed: {
    icon: <Check className="w-12 h-12 text-white" strokeWidth={3} />,
    title: 'Order Confirmed',
    subtitle: 'Your order has been confirmed by the seller.',
    colors: ['#22c55e', '#10b981', '#059669'],
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
  },
  order_delivered: {
    icon: <Truck className="w-10 h-10 text-white" strokeWidth={2.5} />,
    title: 'Order Delivered! 🎉',
    subtitle: 'Check your email and order history for details.',
    colors: ['#06b6d4', '#0891b2', '#0e7490'],
    gradient: 'from-teal-400 via-teal-500 to-teal-600',
  },
  payment_success: {
    icon: <CreditCard className="w-10 h-10 text-white" strokeWidth={2.5} />,
    title: 'Payment Successful',
    subtitle: 'Your payment has been processed successfully.',
    colors: ['#3b82f6', '#2563eb', '#1d4ed8'],
    gradient: 'from-blue-400 via-blue-500 to-blue-600',
  },
  bonus_claimed: {
    icon: <Gift className="w-10 h-10 text-white" strokeWidth={2.5} />,
    title: 'Bonus Claimed! 🎁',
    subtitle: 'Your daily bonus has been added to your wallet.',
    colors: ['#f59e0b', '#d97706', '#b45309'],
    gradient: 'from-amber-400 via-amber-500 to-orange-500',
  },
};

const AnimatedSuccessModal: React.FC<AnimatedSuccessModalProps> = ({
  isOpen, onClose, type, title, subtitle, details, actionLabel = 'Continue', onAction, autoCloseDelay = 4000,
}) => {
  const cfg = config[type];

  useEffect(() => {
    if (isOpen && autoCloseDelay > 0) {
      const timer = setTimeout(() => { onClose(); onAction?.(); }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseDelay, onClose, onAction]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { onClose(); onAction?.(); }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background glow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.2, scale: 1.8 }}
              transition={{ duration: 0.8 }}
              className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-gradient-to-br ${cfg.gradient} blur-3xl`}
            />

            {/* Animated checkmark with ripple rings */}
            <div className="relative w-28 h-28 mx-auto mb-6">
              {/* Outer ripple 1 */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1.6, opacity: [0, 0.3, 0] }}
                transition={{ delay: 0.3, duration: 1.2, repeat: 2, repeatDelay: 0.5 }}
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${cfg.gradient}`}
              />
              {/* Outer ripple 2 */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1.3, opacity: [0, 0.4, 0] }}
                transition={{ delay: 0.5, duration: 1, repeat: 2, repeatDelay: 0.5 }}
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${cfg.gradient}`}
              />
              {/* Middle ring */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 150 }}
                className={`absolute inset-2 rounded-full bg-gradient-to-br ${cfg.gradient} opacity-30`}
              />
              {/* Inner circle with icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 12 }}
                className={`absolute inset-4 rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-xl`}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                >
                  {cfg.icon}
                </motion.div>
              </motion.div>
            </div>

            {/* Title & subtitle */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="relative z-10"
            >
              <h2 className="text-2xl font-bold text-foreground mb-1">{title || cfg.title}</h2>
              <p className="text-muted-foreground text-sm">{subtitle || cfg.subtitle}</p>
            </motion.div>

            {/* Details */}
            {details && details.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-muted/50 rounded-xl p-4 mt-4 mb-2 relative z-10"
              >
                {details.map((d, i) => (
                  <div key={i} className={`flex justify-between items-center ${i > 0 ? 'mt-2 pt-2 border-t border-border' : ''}`}>
                    <span className="text-sm text-muted-foreground">{d.label}</span>
                    <span className="font-bold text-primary text-sm">{d.value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Confetti */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              {[...Array(16)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: '100%', x: `${Math.random() * 100}%`, scale: 0, rotate: 0 }}
                  animate={{ y: `${Math.random() * -100}%`, x: `${(Math.random() - 0.5) * 200}%`, scale: [0, 1, 0.5], rotate: Math.random() * 360 }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 1.5, ease: 'easeOut' }}
                  className="absolute bottom-0 w-2.5 h-2.5"
                  style={{
                    left: `${(i / 16) * 100}%`,
                    backgroundColor: cfg.colors[i % cfg.colors.length],
                    borderRadius: i % 3 === 0 ? '50%' : '2px',
                  }}
                />
              ))}
            </div>

            {/* Action */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="relative z-10 mt-5"
            >
              <Button
                onClick={() => { onClose(); onAction?.(); }}
                className="w-full btn-gradient rounded-xl"
              >
                {actionLabel}
              </Button>
              {autoCloseDelay > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Auto-closing in {Math.ceil(autoCloseDelay / 1000)}s...
                </p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedSuccessModal;
