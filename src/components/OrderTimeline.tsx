import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  Package, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Truck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatusHistory {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface OrderTimelineProps {
  orderId: string;
  currentStatus: string;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ orderId, currentStatus }) => {
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [orderId]);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (data) {
      setHistory(data);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-muted text-muted-foreground';
    
    switch (status) {
      case 'pending':
        return 'bg-primary/10 text-primary';
      case 'processing':
        return 'bg-accent/10 text-accent';
      case 'completed':
        return 'bg-success/10 text-success';
      case 'cancelled':
      case 'refunded':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Order Placed';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'completed':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Default timeline steps based on current status
  const defaultSteps = ['pending', 'processing', 'completed'];
  const cancelledSteps = ['pending', 'cancelled'];
  const refundedSteps = ['pending', 'processing', 'refunded'];

  const getTimelineSteps = () => {
    if (currentStatus === 'cancelled') return cancelledSteps;
    if (currentStatus === 'refunded') return refundedSteps;
    return defaultSteps;
  };

  const timelineSteps = getTimelineSteps();
  const currentStepIndex = timelineSteps.indexOf(currentStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-4">
      <h4 className="text-sm font-semibold text-foreground mb-4">Order Timeline</h4>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
        
        {/* Timeline steps */}
        <div className="space-y-6">
          {timelineSteps.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const historyEntry = history.find(h => h.status === step);
            
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex items-start gap-4 pl-1"
              >
                {/* Icon */}
                <div className={`relative z-10 p-2 rounded-full ${getStatusColor(step, isCompleted)}`}>
                  {getStatusIcon(step)}
                  {isCurrent && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {getStatusLabel(step)}
                    </p>
                    {historyEntry && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(historyEntry.created_at)}
                      </span>
                    )}
                  </div>
                  
                  {historyEntry?.note && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {historyEntry.note}
                    </p>
                  )}
                  
                  {isCurrent && !historyEntry?.note && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {step === 'pending' && 'Your order has been placed successfully.'}
                      {step === 'processing' && 'We are preparing your order.'}
                      {step === 'completed' && 'Your order has been delivered.'}
                      {step === 'cancelled' && 'Order was cancelled.'}
                      {step === 'refunded' && 'Amount has been refunded.'}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline;
