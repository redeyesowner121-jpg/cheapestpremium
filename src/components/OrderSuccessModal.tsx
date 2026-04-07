import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AnimatedSuccessModal from '@/components/AnimatedSuccessModal';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalPrice: number;
  accessLink?: string | null;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen, onClose, productName, totalPrice, accessLink,
}) => {
  const navigate = useNavigate();
  const isInstant = !!accessLink;

  const handleAction = () => {
    navigate('/orders');
  };

  const copyLink = () => {
    if (accessLink) {
      navigator.clipboard.writeText(accessLink);
      toast.success('Link copied!');
    }
  };

  // For instant delivery, show delivered modal; otherwise order placed
  if (isInstant && accessLink) {
    return (
      <>
        <AnimatedSuccessModal
          isOpen={isOpen}
          onClose={onClose}
          type="order_delivered"
          title="Instant Delivery! 🎉"
          subtitle="Your product is ready! Access link is in your order history."
          details={[
            { label: 'Product', value: productName },
            { label: 'Amount Paid', value: `₹${totalPrice}` },
          ]}
          actionLabel="View Orders"
          onAction={handleAction}
          autoCloseDelay={0}
        />
      </>
    );
  }

  return (
    <AnimatedSuccessModal
      isOpen={isOpen}
      onClose={onClose}
      type="order_placed"
      title="Order Placed!"
      subtitle="Your order has been successfully placed."
      details={[
        { label: 'Product', value: productName },
        { label: 'Amount Paid', value: `₹${totalPrice}` },
      ]}
      actionLabel="View Orders"
      onAction={handleAction}
      autoCloseDelay={3000}
    />
  );
};

export default OrderSuccessModal;
