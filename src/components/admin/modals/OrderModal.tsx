import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderHeader } from './order-modal/OrderHeader';
import { DeliveryEditor } from './order-modal/DeliveryEditor';
import { updateOrderStatus } from './order-modal/order-actions';

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  orders: any[];
  onRefresh: () => void;
}

const OrderModal: React.FC<OrderModalProps> = ({ open, onOpenChange, order, onRefresh }) => {
  const [adminNote, setAdminNote] = React.useState(order?.admin_note || '');
  const [accessLink, setAccessLink] = React.useState(order?.access_link || '');
  const [deliveryType, setDeliveryType] = React.useState<'link' | 'credentials'>('link');
  const [credUsername, setCredUsername] = React.useState('');
  const [credPassword, setCredPassword] = React.useState('');

  React.useEffect(() => {
    if (!order) return;
    setAdminNote(order.admin_note || '');
    setAccessLink(order.access_link || '');
    if (order.access_link && order.access_link.includes('ID:') && order.access_link.includes('Password:')) {
      setDeliveryType('credentials');
      const idMatch = order.access_link.match(/ID:\s*(.+)/);
      const pwMatch = order.access_link.match(/Password:\s*(.+)/);
      setCredUsername(idMatch?.[1]?.trim() || '');
      setCredPassword(pwMatch?.[1]?.trim() || '');
    } else {
      setDeliveryType('link');
      setCredUsername('');
      setCredPassword('');
    }
  }, [order]);

  if (!order) return null;

  const getDeliveryValue = () =>
    deliveryType === 'credentials' ? `ID: ${credUsername}\nPassword: ${credPassword}` : accessLink;

  const handleStatus = async (status: string) => {
    const success = await updateOrderStatus(order.id, status, adminNote, getDeliveryValue(), onRefresh);
    if (!success) return;
    setAdminNote('');
    setAccessLink('');
    setCredUsername('');
    setCredPassword('');
    onOpenChange(false);
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <OrderHeader order={order} />

          <Textarea
            placeholder="Admin note (optional)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
          />

          <DeliveryEditor
            deliveryType={deliveryType}
            setDeliveryType={setDeliveryType}
            accessLink={accessLink}
            setAccessLink={setAccessLink}
            credUsername={credUsername}
            setCredUsername={setCredUsername}
            credPassword={credPassword}
            setCredPassword={setCredPassword}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleStatus('processing')}>
              <Clock className="w-4 h-4 mr-2" />
              Processing
            </Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleStatus('completed')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
          </div>
          <Button variant="destructive" className="w-full" onClick={() => handleStatus('cancelled')}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel & Refund
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;
