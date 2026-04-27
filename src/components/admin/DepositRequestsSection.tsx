import React, { useState } from 'react';
import { XCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import DepositRequestItem from './deposit/DepositRequestItem';
import DepositRequestDetailModal from './deposit/DepositRequestDetailModal';
import {
  rejectAllPendingDeposits,
  approveDeposit,
  rejectDeposit,
  type DepositRequest,
} from './deposit/deposit-actions';

interface DepositRequestsSectionProps {
  depositRequests: DepositRequest[];
  onDataChange: () => void;
}

const DepositRequestsSection: React.FC<DepositRequestsSectionProps> = ({ depositRequests, onDataChange }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DepositRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [rejectingAll, setRejectingAll] = useState(false);

  const filteredRequests = depositRequests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = depositRequests.filter(r => r.status === 'pending').length;

  const handleRejectAll = async () => {
    if (!confirm(`Are you sure you want to reject all ${pendingCount} pending requests?`)) return;
    setRejectingAll(true);
    try {
      await rejectAllPendingDeposits(depositRequests);
      onDataChange();
    } catch {
      toast.error('Failed to reject all');
    } finally {
      setRejectingAll(false);
    }
  };

  const handleSelectRequest = (request: DepositRequest) => {
    setSelectedRequest(request);
    setAdminNote(request.admin_note || '');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await approveDeposit(selectedRequest, adminNote);
      setShowModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      onDataChange();
    } catch {
      toast.error('Failed to approve deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await rejectDeposit(selectedRequest, adminNote);
      setShowModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      onDataChange();
    } catch {
      toast.error('Failed to reject deposit');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filter === 'pending' && pendingCount > 0 && (
        <Button onClick={handleRejectAll} disabled={rejectingAll} variant="destructive" size="sm" className="w-full">
          <XCircle className="w-4 h-4 mr-2" />
          {rejectingAll ? 'Rejecting...' : `Reject All (${pendingCount})`}
        </Button>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No {filter === 'all' ? '' : filter} deposit requests</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <DepositRequestItem key={request.id} request={request} onSelect={handleSelectRequest} />
          ))
        )}
      </div>

      <DepositRequestDetailModal
        open={showModal}
        onOpenChange={setShowModal}
        selectedRequest={selectedRequest}
        adminNote={adminNote}
        setAdminNote={setAdminNote}
        processing={processing}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};

export default DepositRequestsSection;
