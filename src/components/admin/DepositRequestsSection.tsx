import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, User, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  transaction_id: string;
  sender_name: string | null;
  payment_method: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
  };
}

interface DepositRequestsSectionProps {
  depositRequests: DepositRequest[];
  onDataChange: () => void;
}

const DepositRequestsSection: React.FC<DepositRequestsSectionProps> = ({
  depositRequests,
  onDataChange
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DepositRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const [rejectingAll, setRejectingAll] = useState(false);

  const filteredRequests = depositRequests.filter(r => 
    filter === 'all' || r.status === filter
  );

  const pendingCount = depositRequests.filter(r => r.status === 'pending').length;

  const handleRejectAll = async () => {
    if (!confirm(`Are you sure you want to reject all ${pendingCount} pending requests?`)) return;
    setRejectingAll(true);
    try {
      const pendingIds = depositRequests.filter(r => r.status === 'pending').map(r => r.id);
      const pendingUserIds = depositRequests.filter(r => r.status === 'pending');
      
      await supabase
        .from('manual_deposit_requests')
        .update({ status: 'rejected', admin_note: 'Bulk rejected by admin' })
        .in('id', pendingIds);

      // Send notifications to all rejected users
      const notifications = pendingUserIds.map(r => ({
        user_id: r.user_id,
        title: 'Deposit Rejected ❌',
        message: `Your deposit request of ₹${r.amount} was rejected.`,
        type: 'wallet'
      }));
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      toast.success(`Rejected ${pendingIds.length} pending requests`);
      onDataChange();
    } catch (error) {
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
      // Update request status
      await supabase
        .from('manual_deposit_requests')
        .update({ 
          status: 'approved',
          admin_note: adminNote || null
        })
        .eq('id', selectedRequest.id);

      // Get user's current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance, total_deposit, has_blue_check, rank_balance')
        .eq('id', selectedRequest.user_id)
        .single();

      if (profile) {
        const newBalance = (profile.wallet_balance || 0) + selectedRequest.amount;
        const newTotalDeposit = (profile.total_deposit || 0) + selectedRequest.amount;
        const newRankBalance = (profile.rank_balance || 0) + selectedRequest.amount;
        
        // Check if user should get blue tick (≥₹1000 deposit)
        const shouldGetBlueTick = !profile.has_blue_check && selectedRequest.amount >= 1000;

        await supabase
          .from('profiles')
          .update({ 
            wallet_balance: newBalance,
            total_deposit: newTotalDeposit,
            rank_balance: newRankBalance,
            ...(shouldGetBlueTick && { has_blue_check: true })
          })
          .eq('id', selectedRequest.user_id);

        // Create transaction
        await supabase.from('transactions').insert({
          user_id: selectedRequest.user_id,
          type: 'deposit',
          amount: selectedRequest.amount,
          status: 'completed',
          description: `Manual deposit - ${selectedRequest.transaction_id}`
        });

        // Send notification
        await supabase.from('notifications').insert({
          user_id: selectedRequest.user_id,
          title: 'Deposit Approved! ✅',
          message: `Your deposit of ₹${selectedRequest.amount} has been approved and added to your wallet.`,
          type: 'wallet'
        });
      }

      toast.success('Deposit approved successfully');
      setShowModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      onDataChange();
    } catch (error) {
      toast.error('Failed to approve deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      await supabase
        .from('manual_deposit_requests')
        .update({ 
          status: 'rejected',
          admin_note: adminNote || 'Request rejected by admin'
        })
        .eq('id', selectedRequest.id);

      // Send notification
      await supabase.from('notifications').insert({
        user_id: selectedRequest.user_id,
        title: 'Deposit Rejected ❌',
        message: `Your deposit request of ₹${selectedRequest.amount} was rejected. ${adminNote ? `Reason: ${adminNote}` : ''}`,
        type: 'wallet'
      });

      toast.success('Deposit rejected');
      setShowModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      onDataChange();
    } catch (error) {
      toast.error('Failed to reject deposit');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-warning/10 text-warning';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'pending' && depositRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {depositRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reject All Button */}
      {filter === 'pending' && pendingCount > 0 && (
        <Button
          onClick={handleRejectAll}
          disabled={rejectingAll}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <XCircle className="w-4 h-4 mr-2" />
          {rejectingAll ? 'Rejecting...' : `Reject All (${pendingCount})`}
        </Button>
      )}

      {/* Requests List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No {filter === 'all' ? '' : filter} deposit requests</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div
              key={request.id}
              onClick={() => handleSelectRequest(request)}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {request.profiles?.name || 'Unknown User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  TXN: {request.transaction_id}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">₹{request.amount}</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Request Detail Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Deposit Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* User Info */}
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

              {/* Amount */}
              <div className="text-center py-4 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl">
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <p className="text-3xl font-bold text-emerald-600">₹{selectedRequest.amount}</p>
              </div>

              {/* Details */}
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

              {/* Admin Note */}
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

              {/* Action Buttons */}
              {selectedRequest.status === 'pending' ? (
                <div className="flex gap-3">
                  <Button 
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    onClick={handleReject}
                    disabled={processing}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
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
    </div>
  );
};

export default DepositRequestsSection;
