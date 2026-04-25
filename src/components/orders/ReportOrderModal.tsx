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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ReportOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

const reportReasons = [
  'Not received',
  'Wrong product',
  'Login not working',
  'Account issue',
  'Payment problem',
  'Other issue',
];

const ReportOrderModal: React.FC<ReportOrderModalProps> = ({
  open,
  onOpenChange,
  orderId,
}) => {
  const { user } = useAuth();
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReport = async () => {
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }
    if (!user || !orderId) {
      toast.error('Login required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from('order_reports').insert({
        order_id: orderId,
        user_id: user.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      }).select('id').single();
      if (error) throw error;

      // Fire-and-forget admin notification (in-app + email)
      supabase.functions.invoke('notify-admin-report', {
        body: {
          report_id: inserted?.id,
          order_id: orderId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        },
      }).catch((err) => console.error('Admin notify failed:', err));

      toast.success('Report submitted! Admin will contact you shortly.');
      onOpenChange(false);
      setReportReason('');
      setReportDetails('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
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
            placeholder="Describe the problem (optional)"
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={3}
            maxLength={1000}
          />

          <Button
            className="w-full btn-gradient rounded-xl"
            onClick={handleSubmitReport}
            disabled={!reportReason || submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportOrderModal;
