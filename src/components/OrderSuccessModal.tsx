import React, { useEffect } from 'react';
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
      const timer = setTimeout(() => {
        onClose();
        navigate('/orders');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-3xl p-8 mx-4 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Success Checkmark */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </div>

        {/* Success Text */}
        <div className="animate-in slide-in-from-bottom-4 duration-300 delay-100">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Order Placed!
          </h2>
          <p className="text-muted-foreground mb-4">
            Your order has been successfully placed
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-muted/50 rounded-xl p-4 mb-6 animate-in slide-in-from-bottom-4 duration-300 delay-150">
          <p className="text-sm text-muted-foreground mb-1">Product</p>
          <p className="font-medium text-foreground text-sm line-clamp-2 mb-2">
            {productName}
          </p>
          <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
          <p className="font-bold text-xl text-primary">₹{totalPrice}</p>
        </div>

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
          <p className="text-xs text-muted-foreground mt-2">
            Redirecting in 3 seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
