import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, ShoppingCart, Zap, Timer, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FlashSaleItem {
  id: string;
  productId?: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  image: string;
  endTime: number;
  productData?: any;
}

interface FlashSaleDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FlashSaleItem | null;
  onBuyClick: (item: FlashSaleItem) => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const FlashSaleDetailModal: React.FC<FlashSaleDetailModalProps> = ({
  open,
  onOpenChange,
  item,
  onBuyClick
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!item || !open) return;

    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = item.endTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      setIsExpired(false);
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [item, open]);

  if (!item) return null;

  const discount = Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100);
  const savings = item.originalPrice - item.salePrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-0">
        <div className="relative">
          {/* Header Image */}
          <div className="relative h-48 overflow-hidden">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            
            {/* Discount Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-4 right-4 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full flex items-center gap-1"
            >
              <Zap className="w-4 h-4" />
              <span className="font-bold">-{discount}%</span>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl font-bold text-foreground">
                {item.name}
              </DialogTitle>
            </DialogHeader>

            {/* Price Section */}
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-primary">₹{item.salePrice}</span>
              <span className="text-lg text-muted-foreground line-through">₹{item.originalPrice}</span>
              <span className="text-sm bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
                <Gift className="w-3 h-3" />
                Save ₹{savings}
              </span>
            </div>

            {/* Countdown Timer */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-5 h-5 text-accent" />
                <span className="font-semibold text-foreground">
                  {isExpired ? 'Sale Ended!' : 'Sale Ends In'}
                </span>
              </div>

              {isExpired ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">This flash sale has ended</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <motion.div
                    key={`days-${timeLeft.days}`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-primary/10 rounded-xl p-3 text-center"
                  >
                    <p className="text-2xl font-bold text-primary">
                      {String(timeLeft.days).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground">Days</p>
                  </motion.div>
                  <motion.div
                    key={`hours-${timeLeft.hours}`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-primary/10 rounded-xl p-3 text-center"
                  >
                    <p className="text-2xl font-bold text-primary">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground">Hours</p>
                  </motion.div>
                  <motion.div
                    key={`minutes-${timeLeft.minutes}`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-primary/10 rounded-xl p-3 text-center"
                  >
                    <p className="text-2xl font-bold text-primary">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground">Mins</p>
                  </motion.div>
                  <motion.div
                    key={`seconds-${timeLeft.seconds}`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-accent/10 rounded-xl p-3 text-center"
                  >
                    <p className="text-2xl font-bold text-accent animate-pulse">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-muted-foreground">Secs</p>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Product Description */}
            {item.productData?.description && (
              <div className="text-sm text-muted-foreground">
                {item.productData.description}
              </div>
            )}

            {/* Buy Button */}
            <Button
              className="w-full btn-gradient h-12 text-lg font-semibold"
              onClick={() => onBuyClick(item)}
              disabled={isExpired}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {isExpired ? 'Sale Ended' : 'Buy Now at ₹' + item.salePrice}
            </Button>

            {!isExpired && (
              <p className="text-center text-xs text-muted-foreground">
                ⚡ Hurry! Limited time offer
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlashSaleDetailModal;
