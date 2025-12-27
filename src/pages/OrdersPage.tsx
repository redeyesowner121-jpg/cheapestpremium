import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  Download,
  MessageSquare,
  ChevronRight,
  Star,
  Flag,
  Phone,
  ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import OrderTimeline from '@/components/OrderTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  product_name: string;
  product_image: string;
  unit_price: number;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  access_link?: string;
  admin_note?: string;
  user_note?: string;
  seller_id?: string;
  buyer_confirmed?: boolean;
  is_withdrawable?: boolean;
}

const OrdersPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending', 'processing'].includes(order.status);
    if (activeTab === 'completed') return ['completed', 'cancelled', 'refunded'].includes(order.status);
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
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

  const handleConfirmReceipt = async (order: Order) => {
    if (!order.seller_id || !user) return;
    
    setConfirmingOrder(order.id);
    
    try {
      // Calculate seller earnings (90% after 10% commission)
      const platformCommission = order.total_price * 0.10;
      const sellerEarnings = order.total_price - platformCommission;

      // Get seller's current balances
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('wallet_balance, pending_balance')
        .eq('id', order.seller_id)
        .single();

      if (sellerProfile) {
        // Move from pending_balance to wallet_balance
        await supabase
          .from('profiles')
          .update({ 
            wallet_balance: (sellerProfile.wallet_balance || 0) + sellerEarnings,
            pending_balance: Math.max(0, (sellerProfile.pending_balance || 0) - sellerEarnings)
          })
          .eq('id', order.seller_id);
      }

      // Update order to mark as confirmed and withdrawable
      await supabase
        .from('orders')
        .update({ 
          buyer_confirmed: true,
          is_withdrawable: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // Update pending transaction to completed for seller
      await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          type: 'sale',
          description: `Sale completed: ${order.product_name} (10% commission deducted)`
        })
        .eq('user_id', order.seller_id)
        .eq('type', 'sale_pending')
        .eq('status', 'pending');

      // Create notification for seller
      await supabase.from('notifications').insert({
        user_id: order.seller_id,
        title: 'Payment Released! 💰',
        message: `Buyer confirmed receipt for ${order.product_name}. ₹${sellerEarnings.toFixed(2)} has been added to your wallet and is now withdrawable.`,
        type: 'payment'
      });

      toast.success('Receipt confirmed! Payment released to seller.');
      await refreshProfile();
      loadOrders();
    } catch (error) {
      console.error('Confirm receipt error:', error);
      toast.error('Failed to confirm receipt');
    } finally {
      setConfirmingOrder(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') return;

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (orderError) {
        toast.error('Failed to cancel order');
        return;
      }

      // Refund to buyer's wallet
      if (profile) {
        const newBalance = (profile.wallet_balance || 0) + order.total_price;
        await supabase
          .from('profiles')
          .update({ wallet_balance: newBalance })
          .eq('id', user?.id);

        await supabase.from('transactions').insert({
          user_id: user?.id,
          type: 'refund',
          amount: order.total_price,
          status: 'completed',
          description: `Order cancelled - ${order.product_name}`
        });
      }

      // If seller order, remove from seller's pending balance
      if (order.seller_id) {
        const platformCommission = order.total_price * 0.10;
        const sellerEarnings = order.total_price - platformCommission;

        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('pending_balance')
          .eq('id', order.seller_id)
          .single();

        if (sellerProfile) {
          await supabase
            .from('profiles')
            .update({ 
              pending_balance: Math.max(0, (sellerProfile.pending_balance || 0) - sellerEarnings)
            })
            .eq('id', order.seller_id);
        }

        // Delete pending transaction
        await supabase
          .from('transactions')
          .delete()
          .eq('user_id', order.seller_id)
          .eq('type', 'sale_pending')
          .eq('status', 'pending');

        // Notify seller
        await supabase.from('notifications').insert({
          user_id: order.seller_id,
          title: 'Order Cancelled',
          message: `Order for ${order.product_name} was cancelled by the buyer.`,
          type: 'order'
        });
      }

      toast.success('Order cancelled and refunded');
      await refreshProfile();
      loadOrders();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel order');
    }
  };

  const handleSubmitReport = () => {
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }
    
    toast.success('Report submitted! We will contact you shortly.');
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
  };

  const reportReasons = [
    'Not received',
    'Payment failed',
    'Wallet problem',
    'Wrong product',
    'Chat with seller',
    'Other issue',
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4">My Orders</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
            {(['all', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-card'
                    : 'text-muted-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.map((order, index) => {
              const isSellerOrder = !!order.seller_id;
              const needsConfirmation = isSellerOrder && order.status === 'completed' && order.access_link && !order.buyer_confirmed;
              
              return (
                <motion.div
                  key={order.id}
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
                          Qty: {order.quantity} × ₹{order.unit_price}
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
                        <p className="font-bold text-foreground">₹{order.total_price}</p>
                        {getStatusIcon(order.status)}
                      </div>
                    </div>

                    {/* Order Status Message */}
                    {order.status === 'pending' && (
                      <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-sm font-medium text-primary">Order Placed</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-4">
                          Waiting for seller to deliver your order.
                        </p>
                      </div>
                    )}
                    
                    {order.status === 'processing' && (
                      <div className="mt-3 p-3 bg-accent/5 rounded-xl border border-accent/20">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-accent" />
                          <span className="text-sm font-medium text-accent">Processing</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Your order is being prepared.
                        </p>
                      </div>
                    )}

                    {/* Confirm Receipt Banner for Seller Orders */}
                    {needsConfirmation && (
                      <div className="mt-3 p-3 bg-warning/10 rounded-xl border border-warning/30">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4 text-warning" />
                          <span className="text-sm font-medium text-warning">Confirm Receipt</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Click below to confirm you received the product. This will release payment to the seller.
                        </p>
                      </div>
                    )}

                    {/* Admin Note */}
                    {order.admin_note && (
                      <div className="mt-3 p-3 bg-success/5 rounded-xl border border-success/20">
                        <p className="text-sm text-success font-medium">📝 Note from seller:</p>
                        <p className="text-sm text-foreground">{order.admin_note}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      {order.access_link && (
                        <Button
                          size="sm"
                          className="flex-1 btn-gradient rounded-xl"
                          onClick={() => window.open(order.access_link, '_blank')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download / Access
                        </Button>
                      )}
                      
                      {needsConfirmation && (
                        <Button
                          size="sm"
                          className="flex-1 bg-success hover:bg-success/90 text-white rounded-xl"
                          onClick={() => handleConfirmReceipt(order)}
                          disabled={confirmingOrder === order.id}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {confirmingOrder === order.id ? 'Confirming...' : 'Confirm Receipt'}
                        </Button>
                      )}

                      {!order.access_link && (
                        <>
                          {order.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowReportModal(true);
                                }}
                              >
                                <Flag className="w-4 h-4 mr-2" />
                                Report
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 rounded-xl"
                                onClick={() => handleCancelOrder(order.id)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {order.status === 'processing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 rounded-xl"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowReportModal(true);
                              }}
                            >
                              <Flag className="w-4 h-4 mr-2" />
                              Report Issue
                            </Button>
                          )}
                          {order.status === 'completed' && order.buyer_confirmed && (
                            <Button
                              size="sm"
                              className="flex-1 btn-gradient rounded-xl"
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Leave Review
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground">
                Start shopping to see your orders here
              </p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              {reportReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setReportReason(reason)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    reportReason === reason
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Additional details (optional)"
              className="rounded-xl"
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
            />

            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-xl">
              <p className="font-medium mb-1 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact Support:
              </p>
              <p className="text-primary font-semibold">+91 8900684167</p>
              <p className="text-xs">(WhatsApp only)</p>
            </div>

            <Button className="w-full btn-gradient rounded-xl" onClick={handleSubmitReport}>
              Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog open={!!selectedOrder && !showReportModal} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="mt-4 space-y-4">
              {/* Order Receipt */}
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-4 pb-3 border-b border-border">
                  <img
                    src={selectedOrder.product_image || 'https://via.placeholder.com/80'}
                    alt={selectedOrder.product_name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedOrder.product_name}</h3>
                    <p className="text-sm text-muted-foreground">Order #{selectedOrder.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Unit Price</span>
                    <span className="font-medium">₹{selectedOrder.unit_price}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-primary">₹{selectedOrder.total_price}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-medium capitalize ${
                      selectedOrder.status === 'completed' ? 'text-success' :
                      selectedOrder.status === 'cancelled' ? 'text-destructive' :
                      'text-primary'
                    }`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Order Date</span>
                    <span className="font-medium">
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Timeline */}
              <OrderTimeline orderId={selectedOrder.id} currentStatus={selectedOrder.status} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default OrdersPage;