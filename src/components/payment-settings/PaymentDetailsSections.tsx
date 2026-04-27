import React from 'react';
import { motion } from 'framer-motion';
import { Link as LinkIcon, QrCode, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  paymentLink: string; setPaymentLink: (v: string) => void; onSaveLink: () => void;
  upiId: string; setUpiId: (v: string) => void;
  upiName: string; setUpiName: (v: string) => void; onSaveUpi: () => void;
  instructions: string; setInstructions: (v: string) => void; onSaveInstructions: () => void;
}

const PaymentDetailsSections: React.FC<Props> = ({
  paymentLink, setPaymentLink, onSaveLink,
  upiId, setUpiId, upiName, setUpiName, onSaveUpi,
  instructions, setInstructions, onSaveInstructions,
}) => (
  <>
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-accent/10"><LinkIcon className="w-5 h-5 text-accent" /></div>
        <div>
          <h3 className="font-semibold text-foreground">Payment Link</h3>
          <p className="text-sm text-muted-foreground">Alternative payment URL</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)}
          placeholder="https://razorpay.me/@your-link" className="rounded-xl" />
        <Button onClick={onSaveLink} className="rounded-xl">Save</Button>
      </div>
    </motion.div>

    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-success/10"><QrCode className="w-5 h-5 text-success" /></div>
        <div>
          <h3 className="font-semibold text-foreground">Dynamic UPI QR</h3>
          <p className="text-sm text-muted-foreground">Auto-generate QR with amount</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">UPI ID</label>
          <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="example@upi" className="rounded-xl" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Receiver Name (shown to users)</label>
          <Input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Your Name / Business Name" className="rounded-xl" />
        </div>
        <Button onClick={onSaveUpi} className="w-full rounded-xl">Save UPI Details</Button>
        {upiId && (
          <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg break-all">
            Preview: upi://pay?pa={upiId}&pn={encodeURIComponent(upiName)}&am=100
          </p>
        )}
      </div>
    </motion.div>

    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-success/10"><Settings className="w-5 h-5 text-success" /></div>
        <div>
          <h3 className="font-semibold text-foreground">Payment Instructions</h3>
          <p className="text-sm text-muted-foreground">Shown to users during manual deposit</p>
        </div>
      </div>
      <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
        placeholder="Enter payment instructions..." className="rounded-xl mb-2" rows={3} />
      <Button onClick={onSaveInstructions} className="w-full rounded-xl">Save Instructions</Button>
    </motion.div>
  </>
);

export default PaymentDetailsSections;
