import React from 'react';
import { Clock, CheckCircle, XCircle, Link, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  adminNote: string;
  accessLink: string;
  onAdminNoteChange: (note: string) => void;
  onAccessLinkChange: (link: string) => void;
  onUpdateStatus: (orderId: string, status: string) => void;
}

const AdminOrderModal: React.FC<AdminOrderModalProps> = ({
  open, onOpenChange, order,
  adminNote, accessLink, onAdminNoteChange, onAccessLinkChange,
  onUpdateStatus
}) => {
  const [deliveryType, setDeliveryType] = React.useState<'link' | 'credentials'>('link');
  const [credUsername, setCredUsername] = React.useState('');
  const [credPassword, setCredPassword] = React.useState('');

  // Build access link from credentials format
  const getDeliveryValue = () => {
    if (deliveryType === 'credentials') {
      return `ID: ${credUsername}\nPassword: ${credPassword}`;
    }
    return accessLink;
  };

  const handleUpdateStatus = (orderId: string, status: string) => {
    onAccessLinkChange(getDeliveryValue());
    setTimeout(() => onUpdateStatus(orderId, status), 50);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 bg-muted rounded-xl">
            <img src={order.product_image || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <p className="font-semibold">{order.product_name}</p>
              <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
              <p className="font-bold text-primary">₹{order.total_price}</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
            <p className="font-medium">Customer Details:</p>
            <p>Name: {order.profiles?.name}</p>
            <p>Email: {order.profiles?.email}</p>
            <p>Phone: {order.profiles?.phone || 'N/A'}</p>
          </div>

          {order.user_note && (
            <div className="p-3 bg-primary/5 rounded-xl">
              <p className="text-xs font-medium mb-1">Customer Note:</p>
              <p className="text-sm">{order.user_note}</p>
            </div>
          )}

          {/* Delivery Type Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Delivery Type</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={deliveryType === 'link' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryType('link')}
                className="gap-1.5"
              >
                <Link className="w-3.5 h-3.5" />
                Direct Link
              </Button>
              <Button
                type="button"
                variant={deliveryType === 'credentials' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryType('credentials')}
                className="gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                ID / Password
              </Button>
            </div>
          </div>

          {deliveryType === 'link' ? (
            <div>
              <label className="text-sm font-medium mb-1 block">Access Link</label>
              <Input placeholder="https://..." value={accessLink} onChange={(e) => onAccessLinkChange(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Username / Email / ID</label>
                <Input placeholder="user@example.com" value={credUsername} onChange={(e) => setCredUsername(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <Input placeholder="••••••••" value={credPassword} onChange={(e) => setCredPassword(e.target.value)} />
              </div>
            </div>
          )}

          <Textarea placeholder="Add note for customer..." value={adminNote} onChange={(e) => onAdminNoteChange(e.target.value)} />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleUpdateStatus(order.id, 'processing')}>
              <Clock className="w-4 h-4 mr-2" />
              Processing
            </Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleUpdateStatus(order.id, 'completed')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
          </div>
          <Button variant="destructive" className="w-full" onClick={() => handleUpdateStatus(order.id, 'cancelled')}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel & Refund
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOrderModal;
