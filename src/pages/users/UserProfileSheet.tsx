import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ShoppingBag } from 'lucide-react';
import BlueTick from '@/components/BlueTick';
import { UserProfile } from './types';

interface Props {
  user: UserProfile;
  orders: any[];
  onClose: () => void;
}

export const UserProfileSheet: React.FC<Props> = ({ user, orders, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-50 bg-black/50 flex items-end"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25 }}
      className="w-full max-w-lg mx-auto bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />

        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name?.charAt(0) || 'U'
              )}
            </div>
            {user.has_blue_check && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 gradient-accent rounded-full flex items-center justify-center">
                <BlueTick size="sm" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {user.name || 'User'}
              {user.has_blue_check && <BlueTick size="md" />}
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-muted rounded-2xl">
            <p className="text-2xl font-bold text-success">
              ₹{(user.total_deposit || 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Deposited</p>
          </div>
          <div className="text-center p-4 bg-muted rounded-2xl">
            <p className="text-2xl font-bold text-primary">
              {user.total_orders || 0}
            </p>
            <p className="text-sm text-muted-foreground">Orders Placed</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-foreground mb-3">Recent Orders</h3>
          {orders.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {orders.map((order) => (
                <div key={order.id} className="aspect-square relative rounded-lg overflow-hidden">
                  <img
                    src={order.product_image || 'https://via.placeholder.com/150'}
                    alt={order.product_name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1 left-1 right-1">
                    <p className="text-[9px] text-white font-medium truncate">{order.product_name}</p>
                    <p className="text-[10px] text-white/80">₹{order.total_price}</p>
                  </div>
                  {order.status === 'completed' && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  </motion.div>
);
