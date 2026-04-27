import React from 'react';
import { CheckCircle, XCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getStatusColor, getStatusIcon } from './DepositRequestItem';
import type { DepositRequest } from './deposit-actions';

interface DepositRequestDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequest: DepositRequest | null;
  adminNote: string;
  setAdminNote: (note: string) => void;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const DepositRequestDetailModal: React.FC<DepositRequestDetailModalProps> = ({
  open, onOpenChange, selectedRequest, adminNote, setAdminNote, processing, onApprove, onReject,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm rounded-3xl">
      <DialogHeader>
        <DialogTitle>Deposit Request Details</DialogTitle>
      </DialogHeader>
      {selectedRequest && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{selectedRequest.profiles?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.profiles?.email}</p>
              </div>
            </div>
          </div>

          <div className="text-center py-4 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Amount</p>
            <p className="text-3xl font-bold text-emerald-600">₹{selectedRequest.amount}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="font-medium">{selectedRequest.transaction_id}</span>
            </div>
            {selectedRequest.sender_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sender Name</span>
                <span className="font-medium">{selectedRequest.sender_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium uppercase">{selectedRequest.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{new Date(selectedRequest.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${getStatusColor(selectedRequest.status)}`}>
                {getStatusIcon(selectedRequest.status)}
                {selectedRequest.status}
              </span>
            </div>
          </div>

          {selectedRequest.status === 'pending' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Admin Note (Optional)</label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add a note for the user..."
                className="rounded-xl"
                rows={2}
              />
            </div>
          )}

          {selectedRequest.status === 'pending' ? (
            <div className="flex gap-3">
              <Button onClick={onApprove} disabled={processing} className="flex-1 bg-success hover:bg-success/90">
                <CheckCircle className="w-4 h-4 mr-2" />Approve
              </Button>
              <Button onClick={onReject} disabled={processing} variant="destructive" className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />Reject
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-2">
              This request has already been {selectedRequest.status}
              {selectedRequest.admin_note && (
                <p className="mt-2 p-2 bg-muted rounded-lg">
                  <strong>Note:</strong> {selectedRequest.admin_note}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>
);

export default DepositRequestDetailModal;
