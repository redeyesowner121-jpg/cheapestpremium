import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Props {
  enabled: boolean;
  onToggle: () => void;
}

const AutoPaymentSection: React.FC<Props> = ({ enabled, onToggle }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-card rounded-2xl p-4 shadow-card">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Automatic Payment (Razorpay)</h3>
          <p className="text-sm text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  </motion.div>
);

export default AutoPaymentSection;
