import React from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Flag,
  RefreshCw,
  Package,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import CredentialDisplay from './CredentialDisplay';

interface Order {
  id: string;
  product_id?: string;
  product_name: string;
  product_image: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  access_link?: string;
  admin_note?: string;
  seller_id?: string;
  buyer_confirmed?: boolean;
  discount_applied?: number;
}

interface OrderCardProps {
  order: Order;
  index: number;
  confirmingOrder: string | null;
  onConfirmReceipt: (order: Order) => void;
  onCancelOrder: (orderId: string) => void;
  onReport: (order: Order) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'shipped':
    case 'delivered':
      return <CheckCircle className="w-5 h-5 text-success" />;
    case 'processing':
      return <Clock className="w-5 h-5 text-accent animate-pulse" />;
    case 'pending':
      return <AlertCircle className="w-5 h-5 text-primary" />;
    case 'cancelled':
    case 'refunded':
      return <XCircle className="w-5 h-5 text-destructive" />;
    default:
      return <Clock className="w-5 h-5 text-muted-foreground" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'shipped':
    case 'delivered':
      return 'bg-success/10 text-success';
    case 'processing':
      return 'bg-accent/10 text-accent';
    case 'pending':
      return 'bg-primary/10 text-primary';
    case 'cancelled':
    case 'refunded':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  index,
  confirmingOrder,
  onConfirmReceipt,
  onCancelOrder,
  onReport,
}) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrencyFormat();
  const isSellerOrder = !!order.seller_id;
  const needsConfirmation = isSellerOrder && order.status === 'completed' && order.access_link && !order.buyer_confirmed;
  
  const handleReorder = () => {
    if (order.product_id) {
      navigate(`/product/${order.product_id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-2xl shadow-card overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <img
            src={order.product_image || 'https://via.placeholder.com/64'}
            alt={order.product_name}
            className="w-16 h-16 rounded-xl object-cover"
          />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{order.product_name}</h3>
            <p className="text-sm text-muted-foreground">
              Qty: {order.quantity} × {formatPrice(order.unit_price)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              {order.buyer_confirmed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                  Confirmed
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-foreground">{formatPrice(order.total_price)}</p>
            {getStatusIcon(order.status)}
          </div>
        </div>

        {/* Delivered Access Link Section */}
        {order.access_link && (
          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-100/60 dark:bg-emerald-900/40">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Delivered — Your Access</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
            </div>
            {/* Body */}
            <div className="px-3 py-3">
              <CredentialDisplay rawCredential={order.access_link} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {needsConfirmation && (
            <Button
              size="sm"
              className="flex-1 bg-success hover:bg-success/90 text-white rounded-xl"
              onClick={() => onConfirmReceipt(order)}
              disabled={confirmingOrder === order.id}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {confirmingOrder === order.id ? 'Confirming...' : 'Confirm Receipt'}
            </Button>
          )}

          {!order.access_link && order.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => onReport(order)}
              >
                <Flag className="w-4 h-4 mr-2" />
                Report
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={() => onCancelOrder(order.id)}
              >
                Cancel
              </Button>
            </>
          )}
          
          {order.product_id && (order.status === 'completed' || order.status === 'cancelled' || order.status === 'refunded') && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={handleReorder}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reorder
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;
