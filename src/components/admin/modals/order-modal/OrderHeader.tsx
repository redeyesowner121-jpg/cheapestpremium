import React from 'react';
import { MessageCircle } from 'lucide-react';

interface Props {
  order: any;
}

export const OrderHeader: React.FC<Props> = ({ order }) => (
  <>
    <div className="flex items-start gap-4">
      <img
        src={order.product_image || 'https://via.placeholder.com/80'}
        alt=""
        className="w-20 h-20 rounded-xl object-cover"
      />
      <div>
        <p className="font-bold text-foreground">{order.product_name}</p>
        <p className="text-primary font-bold text-lg">₹{order.total_price}</p>
        <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
          order.status === 'completed' ? 'bg-success/10 text-success' :
          order.status === 'pending' ? 'bg-accent/10 text-accent' :
          order.status === 'processing' ? 'bg-secondary/10 text-secondary' :
          'bg-destructive/10 text-destructive'
        }`}>
          {order.status}
        </span>
      </div>
    </div>

    <div className="bg-muted rounded-xl p-3 text-sm space-y-1">
      <p><strong>Customer:</strong> {order.user_id ? (order.profiles?.name || 'User') : (order.guest_name || 'Guest')}</p>
      <p><strong>Email:</strong> {order.user_id ? (order.profiles?.email || 'N/A') : (order.guest_email || 'N/A')}</p>
      <p><strong>Phone:</strong> {order.user_id ? (order.profiles?.phone || 'N/A') : (order.guest_phone || 'N/A')}</p>
      {!order.user_id && order.guest_email && (
        <p className="text-accent font-medium">🏷️ Guest Order</p>
      )}
      {(() => {
        const phoneNumber = order.user_id ? order.profiles?.phone : order.guest_phone;
        if (phoneNumber) {
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          const whatsappNumber = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
          return (
            <a
              href={`https://wa.me/${whatsappNumber}?text=Hi ${order.user_id ? (order.profiles?.name || 'Customer') : (order.guest_name || 'Customer')}, regarding your order for ${order.product_name}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          );
        }
        return null;
      })()}
      <p><strong>Ordered:</strong> {new Date(order.created_at).toLocaleString()}</p>
      {order.user_note && (
        <p className="mt-2 p-2 bg-background rounded-lg">
          <strong>Customer Note:</strong> {order.user_note}
        </p>
      )}
    </div>
  </>
);
