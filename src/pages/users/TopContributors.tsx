import React from 'react';
import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import BlueTick from '@/components/BlueTick';
import { RankBadgeInline } from '@/components/RankBadge';
import { UserProfile } from './types';

interface Props {
  users: UserProfile[];
  onSelect: (user: UserProfile) => void;
}

export const TopContributors: React.FC<Props> = ({ users, onSelect }) => (
  <div className="mb-6">
    <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
      <Award className="w-5 h-5 text-accent" />
      Top Contributors
    </h2>
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
      {users.slice(0, 5).map((user, index) => (
        <motion.div
          key={user.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(user)}
          className="flex-shrink-0 w-24 text-center cursor-pointer"
        >
          <div className="relative inline-block">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground mx-auto overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name?.charAt(0) || 'U'
              )}
            </div>
            {user.has_blue_check && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-card rounded-full flex items-center justify-center shadow-card">
                <BlueTick size="sm" />
              </div>
            )}
            {index < 3 && (
              <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-amber-400 text-amber-900' :
                index === 1 ? 'bg-slate-300 text-slate-700' :
                'bg-amber-600 text-amber-100'
              }`}>
                {index + 1}
              </div>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-2 truncate">
            {user.name?.split(' ')[0] || 'User'}
          </p>
          <RankBadgeInline rankBalance={user.rank_balance || 0} size="sm" />
          <p className="text-xs text-muted-foreground mt-0.5">
            ₹{(user.rank_balance || 0).toLocaleString()}
          </p>
        </motion.div>
      ))}
    </div>
  </div>
);
