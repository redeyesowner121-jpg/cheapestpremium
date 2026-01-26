import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ReportOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

const reportReasons = [
  'Not received',
  'Payment failed',
  'Wallet problem',
  'Wrong product',
  'Chat with seller',
  'Other issue',
];

const ReportOrderModal: React.FC<ReportOrderModalProps> = ({
  open,
  onOpenChange,
  orderId,
}) => {
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const handleSubmitReport = () => {
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }
    
    toast.success('Report submitted! We will contact you shortly.');
    onOpenChange(false);
    setReportReason('');
    setReportDetails('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            Report Issue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-2">
            {reportReasons.map((reason) => (
              <button
                key={reason}
                onClick={() => setReportReason(reason)}
                className={`p-3 rounded-xl text-sm font-medium transition-all ${
                  reportReason === reason
                    ? 'bg-destructive text-white'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Additional details (optional)"
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={3}
          />

          <Button
            className="w-full btn-gradient rounded-xl"
            onClick={handleSubmitReport}
            disabled={!reportReason}
          >
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportOrderModal;
