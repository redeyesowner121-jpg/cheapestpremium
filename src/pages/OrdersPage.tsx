import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Star,
  Flag
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
import { useAuth } from '@/contexts/AuthContext';

interface Order {
  id: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  orderDate: number;
  accessLink?: string;
  adminNote?: string;
  userNote?: string;
  hasReviewed?: boolean;
}

const mockOrders: Order[] = [
  {
    id: 'ORD001',
    productName: 'Netflix Premium 1 Month',
    productImage: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200&h=200&fit=crop',
    price: 79,
    quantity: 1,
    status: 'completed',
    orderDate: Date.now() - 86400000,
    accessLink: 'https://netflix.com/activate',
    adminNote: 'Login credentials sent to your email',
  },
  {
    id: 'ORD002',
    productName: 'Spotify Premium',
    productImage: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=200&h=200&fit=crop',
    price: 29,
    quantity: 2,
    status: 'processing',
    orderDate: Date.now() - 3600000,
    userNote: 'Please send to my email: user@example.com',
  },
  {
    id: 'ORD003',
    productName: 'ChatGPT Plus',
    productImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=200&h=200&fit=crop',
    price: 399,
    quantity: 1,
    status: 'pending',
    orderDate: Date.now() - 7200000,
  },
  {
    id: 'ORD004',
    productName: 'Canva Pro',
    productImage: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=200&h=200&fit=crop',
    price: 99,
    quantity: 1,
    status: 'cancelled',
    orderDate: Date.now() - 172800000,
  },
];

const OrdersPage: React.FC = () => {
  const { userData } = useAuth();
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');

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

  const reportReasons = [
    'Not received',
    'Payment failed',
    'Wallet problem',
    'Wrong product',
    'Other issue',
  ];

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
            {filteredOrders.map((order, index) => (
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
                      src={order.productImage}
                      alt={order.productName}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{order.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Qty: {order.quantity} × ₹{order.price}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">₹{order.price * order.quantity}</p>
                      {getStatusIcon(order.status)}
                    </div>
                  </div>

                  {/* Order Status Message */}
                  {order.status === 'pending' && (
                    <div className="mt-3 p-3 bg-primary/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Order Placed</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Processing may take up to 24 hours
                      </p>
                    </div>
                  )}

                  {/* Admin Note */}
                  {order.adminNote && (
                    <div className="mt-3 p-3 bg-success/5 rounded-xl">
                      <p className="text-sm text-success font-medium">Note from seller:</p>
                      <p className="text-sm text-foreground">{order.adminNote}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {order.accessLink ? (
                      <Button
                        size="sm"
                        className="flex-1 btn-gradient rounded-xl"
                        onClick={() => window.open(order.accessLink, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Access Link
                      </Button>
                    ) : (
                      <>
                        {order.status === 'pending' || order.status === 'processing' ? (
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
                            >
                              Cancel Order
                            </Button>
                          </>
                        ) : order.status === 'completed' && !order.hasReviewed ? (
                          <Button
                            size="sm"
                            className="flex-1 btn-gradient rounded-xl"
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Leave Review
                          </Button>
                        ) : null}
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
            ))}
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
            />

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Contact Support:</p>
              <p>+91 890068416 or +91 8075101327</p>
              <p className="text-xs">(WhatsApp only)</p>
            </div>

            <Button className="w-full btn-gradient rounded-xl">
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
              <div className="flex items-center gap-4">
                <img
                  src={selectedOrder.productImage}
                  alt={selectedOrder.productName}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div>
                  <h3 className="font-semibold text-foreground">{selectedOrder.productName}</h3>
                  <p className="text-sm text-muted-foreground">Order #{selectedOrder.id}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-medium">{selectedOrder.quantity}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">₹{selectedOrder.price}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-primary">
                    ₹{selectedOrder.price * selectedOrder.quantity}
                  </span>
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
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(selectedOrder.orderDate).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedOrder.userNote && (
                <div className="p-3 bg-muted rounded-xl">
                  <p className="text-sm font-medium text-foreground">Your Note:</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.userNote}</p>
                </div>
              )}

              {selectedOrder.adminNote && (
                <div className="p-3 bg-success/10 rounded-xl">
                  <p className="text-sm font-medium text-success">Seller's Note:</p>
                  <p className="text-sm text-foreground">{selectedOrder.adminNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default OrdersPage;
