import React from 'react';
import { motion } from 'framer-motion';
import { Edit, Trash2, Percent, IndianRupee, Package, Zap, Calendar, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { Coupon } from './useCouponForm';

interface Props {
  coupon: Coupon;
  onCopy: (code: string) => void;
  onToggle: (c: Coupon) => void;
  onEdit: (c: Coupon) => void;
  onDelete: (id: string) => void;
}

const CouponListItem: React.FC<Props> = ({ coupon, onCopy, onToggle, onEdit, onDelete }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-card rounded-xl p-4 border ${coupon.is_active ? 'border-success/30' : 'border-border opacity-60'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <button onClick={() => onCopy(coupon.code)}
            className="flex items-center gap-1 font-mono font-bold text-lg text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors">
            {coupon.code}<Copy className="w-3 h-3" />
          </button>
          {coupon.discount_type === 'percentage' ? (
            <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
              <Percent className="w-3 h-3" />{coupon.discount_value}% off
            </span>
          ) : (
            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full flex items-center gap-1">
              <IndianRupee className="w-3 h-3" />₹{coupon.discount_value} off
            </span>
          )}
        </div>
        {coupon.description && (
          <p className="text-sm text-muted-foreground mt-1">{coupon.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {coupon.product_id && coupon.products && (
            <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Package className="w-3 h-3" />{coupon.products.name}
            </span>
          )}
          {coupon.flash_sale_id && coupon.flash_sales && (
            <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-3 h-3" />Flash Sale: {coupon.flash_sales.products?.name}
            </span>
          )}
          {coupon.min_purchase > 0 && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Min ₹{coupon.min_purchase}
            </span>
          )}
          {coupon.usage_limit && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {coupon.used_count}/{coupon.usage_limit} used
            </span>
          )}
          {coupon.expires_at && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
              <Calendar className="w-3 h-3" />Expires {new Date(coupon.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={coupon.is_active} onCheckedChange={() => onToggle(coupon)} />
        <Button size="sm" variant="ghost" onClick={() => onEdit(coupon)}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(coupon.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </motion.div>
);

export default CouponListItem;
