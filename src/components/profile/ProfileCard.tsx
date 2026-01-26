import React from 'react';
import { motion } from 'framer-motion';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BlueTick from '@/components/BlueTick';
import { RankBadge } from '@/components/RankBadge';
import { UserProfile } from '@/contexts/AuthContext';

interface ProfileCardProps {
  profile: UserProfile | null;
  onEditProfile: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEditProfile }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gradient-primary rounded-3xl p-6 text-center shadow-glow"
    >
      <div className="relative inline-block">
        <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto">
          {profile?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        {profile?.has_blue_check && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
            <BlueTick size="sm" />
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-primary-foreground mt-4 flex items-center justify-center gap-2">
        {profile?.name || 'User'}
        {profile?.has_blue_check && <BlueTick size="md" />}
      </h2>
      <p className="text-primary-foreground/70 text-sm">{profile?.email}</p>
      {profile?.phone && (
        <p className="text-primary-foreground/60 text-xs">{profile.phone}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-foreground">
            ₹{profile?.total_deposit?.toFixed(0) || '0'}
          </p>
          <p className="text-xs text-primary-foreground/70">Deposited</p>
        </div>
        <div className="text-center border-x border-primary-foreground/20">
          <p className="text-2xl font-bold text-primary-foreground">
            {profile?.total_orders || 0}
          </p>
          <p className="text-xs text-primary-foreground/70">Orders</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-foreground">0</p>
          <p className="text-xs text-primary-foreground/70">Referrals</p>
        </div>
      </div>

      {/* Rank Badge */}
      <div className="mt-4 p-3 bg-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-primary-foreground/80">Your Rank (ক্লিক করুন)</span>
          <RankBadge rankBalance={profile?.rank_balance || 0} size="md" clickable={true} />
        </div>
      </div>
      
      {/* Blue Tick Progress */}
      {!profile?.has_blue_check && (
        <div className="mt-4 p-3 bg-white/10 rounded-xl">
          <p className="text-xs text-primary-foreground/80 mb-2">
            Deposit ₹{Math.max(0, 1000 - (profile?.total_deposit || 0))} more to get Blue Tick!
          </p>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, ((profile?.total_deposit || 0) / 1000) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <Button
        variant="outline"
        className="mt-6 bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20 rounded-xl"
        onClick={onEditProfile}
      >
        <Edit className="w-4 h-4 mr-2" />
        Edit Profile
      </Button>
    </motion.div>
  );
};

export default ProfileCard;
