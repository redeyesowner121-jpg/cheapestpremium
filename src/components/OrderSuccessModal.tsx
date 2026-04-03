import React, { useEffect } from 'react';
import { Check, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalPrice: number;
  accessLink?: string | null;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  onClose,
  productName,
  totalPrice,
  accessLink,
}) => {
  const navigate = useNavigate();
  const isInstant = !!accessLink;

  useEffect(() => {
    if (isOpen && !isInstant) {
      const timer = setTimeout(() => {
        onClose();
        navigate('/orders');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, navigate, isInstant]);

  if (!isOpen) return null;

  const copyLink = () => {
    if (accessLink) {
      navigator.clipboard.writeText(accessLink);
      toast.success('Link copied!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Success Checkmark */}
        <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-300 ${
          isInstant 
            ? 'bg-gradient-to-br from-emerald-400 to-teal-600' 
            : 'bg-gradient-to-br from-green-400 to-green-600'
        }`}>
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </div>

        {/* Success Text */}
        <div className="animate-in slide-in-from-bottom-4 duration-300 delay-100">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isInstant ? '🎉 Instant Delivery!' : 'Order Placed!'}
          </h2>
          <p className="text-muted-foreground mb-4">
            {isInstant 
              ? 'Your product is ready! Access link below.' 
              : 'Your order has been successfully placed'}
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-muted/50 rounded-xl p-4 mb-4 animate-in slide-in-from-bottom-4 duration-300 delay-150">
          <p className="text-sm text-muted-foreground mb-1">Product</p>
          <p className="font-medium text-foreground text-sm line-clamp-2 mb-2">
            {productName}
          </p>
          <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
          <p className="font-bold text-xl text-primary">₹{totalPrice}</p>
        </div>

        {/* Access Link Section */}
        {isInstant && accessLink && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-4 animate-in slide-in-from-bottom-4 duration-300 delay-200">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2">🔗 Your Access Link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded-lg text-xs font-mono break-all text-left">
                {accessLink}
              </code>
              <Button size="sm" variant="ghost" onClick={copyLink} className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <a
              href={accessLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" /> Open Link
            </a>
            <p className="text-[10px] text-muted-foreground mt-2">⚠️ This link is for you only. Do not share.</p>
          </div>
        )}

        {/* Action Button */}
        <div className="animate-in slide-in-from-bottom-4 duration-300 delay-200">
          <Button 
            onClick={() => {
              onClose();
              navigate('/orders');
            }}
            className="w-full btn-gradient rounded-xl"
          >
            View Orders
          </Button>
          {!isInstant && (
            <p className="text-xs text-muted-foreground mt-2">
              Redirecting in 3 seconds...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
