import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ReferralSectionProps {
  referralCode: string;
  onCustomize: () => void;
}

const ReferralSection: React.FC<ReferralSectionProps> = ({ referralCode, onCustomize }) => {
  const handleCopyReferralCode = () => {
    navigator.clipboard.writeText(referralCode || '');
    toast.success('Referral code copied!');
  };

  const handleShare = async () => {
    const shareText = `Join RKR Premium Store with my referral code ${referralCode} and get bonus!`;
    const shareUrl = `${window.location.origin}?ref=${referralCode}`;
    
    const shareData = {
      title: 'Join RKR Premium Store',
      text: shareText,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success('Referral link copied to clipboard!');
      }
    } catch (error) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success('Referral link copied to clipboard!');
      } catch (e) {
        toast.error('Failed to share');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6 bg-card rounded-2xl p-4 shadow-card"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Your Referral Code</h3>
        <button onClick={onCustomize} className="text-xs text-primary font-medium">
          Customize
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono font-bold text-foreground">
          {referralCode || 'RKRXXXX'}
        </div>
        <Button size="icon" variant="outline" className="rounded-xl" onClick={handleCopyReferralCode}>
          <Copy className="w-4 h-4" />
        </Button>
        <Button size="icon" className="btn-gradient rounded-xl" onClick={handleShare}>
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Earn ₹10 for every friend who signs up using your code!
      </p>
    </motion.div>
  );
};

export default ReferralSection;
