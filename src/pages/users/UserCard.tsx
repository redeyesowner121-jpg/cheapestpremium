import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ShoppingBag, ChevronRight } from 'lucide-react';
import BlueTick from '@/components/BlueTick';
import { RankBadgeInline } from '@/components/RankBadge';
import { UserProfile } from './types';

interface Props {
  user: UserProfile;
  index: number;
  onSelect: (user: UserProfile) => void;
}

export const UserCard: React.FC<Props> = ({ user, index, onSelect }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.1 + index * 0.03 }}
    onClick={() => onSelect(user)}
    className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover cursor-pointer"
  >
    <div className="relative">
      <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground overflow-hidden">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          user.name?.charAt(0) || 'U'
        )}
      </div>
      {user.has_blue_check && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-card rounded-full flex items-center justify-center shadow-sm">
          <BlueTick size="sm" />
        </div>
      )}
    </div>

    <div className="flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-foreground flex items-center gap-1">
          {user.name || 'User'}
          {user.has_blue_check && <BlueTick size="sm" />}
        </h3>
        <RankBadgeInline rankBalance={user.rank_balance || 0} size="sm" />
        {user.is_reseller && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
            Reseller
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3 text-success" />
          <span>₹{(user.rank_balance || 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShoppingBag className="w-3 h-3 text-primary" />
          <span>{user.total_orders || 0} orders</span>
        </div>
      </div>
    </div>

    <ChevronRight className="w-5 h-5 text-muted-foreground" />
  </motion.div>
);
