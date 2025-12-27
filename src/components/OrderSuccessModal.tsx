import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalPrice: number;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  onClose,
  productName,
  totalPrice
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      // Auto redirect after 3 seconds
      const timer = setTimeout(() => {
        onClose();
        navigate('/orders');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, navigate]);

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
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl"
          >
            {/* Success Checkmark Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg"
            >
              <motion.div
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Check className="w-12 h-12 text-white" strokeWidth={3} />
              </motion.div>
            </motion.div>

            {/* Success Text */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Order Placed!
              </h2>
              <p className="text-muted-foreground mb-4">
                Your order has been successfully placed
              </p>
            </motion.div>

            {/* Order Details */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-muted/50 rounded-xl p-4 mb-6"
            >
              <p className="text-sm text-muted-foreground mb-1">Product</p>
              <p className="font-medium text-foreground text-sm line-clamp-2 mb-2">
                {productName}
              </p>
              <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
              <p className="font-bold text-xl text-primary">₹{totalPrice}</p>
            </motion.div>

            {/* Confetti-like dots animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    y: "50%", 
                    x: "50%", 
                    scale: 0,
                    opacity: 1 
                  }}
                  animate={{ 
                    y: `${Math.random() * 100}%`,
                    x: `${Math.random() * 100}%`,
                    scale: [0, 1, 0],
                    opacity: [1, 1, 0]
                  }}
                  transition={{ 
                    delay: 0.3 + i * 0.05,
                    duration: 1,
                    ease: "easeOut"
                  }}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5]
                  }}
                />
              ))}
            </div>

            {/* Action Button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Button 
                onClick={() => {
                  onClose();
                  navigate('/orders');
                }}
                className="w-full btn-gradient rounded-xl"
              >
                View Orders
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Redirecting in 3 seconds...
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderSuccessModal;
