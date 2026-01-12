import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  QrCode, 
  Link as LinkIcon, 
  Upload, 
  Check, 
  X, 
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
}

interface ManualDepositRequest {
  id: string;
  user_id: string;
  amount: number;
  transaction_id: string;
  payment_method: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
  };
}

const AdminPaymentSettings: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [depositRequests, setDepositRequests] = useState<ManualDepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ManualDepositRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  // Form states
  const [paymentLink, setPaymentLink] = useState('');
  const [instructions, setInstructions] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load payment settings
    const { data: settingsData } = await supabase
      .from('payment_settings')
      .select('*');
    
    if (settingsData) {
      setSettings(settingsData);
      const linkSetting = settingsData.find(s => s.setting_key === 'manual_payment_link');
      const instructionSetting = settingsData.find(s => s.setting_key === 'manual_payment_instructions');
      const upiIdSetting = settingsData.find(s => s.setting_key === 'upi_id');
      const upiNameSetting = settingsData.find(s => s.setting_key === 'upi_name');
      if (linkSetting) setPaymentLink(linkSetting.setting_value || '');
      if (instructionSetting) setInstructions(instructionSetting.setting_value || '');
      if (upiIdSetting) setUpiId(upiIdSetting.setting_value || '');
      if (upiNameSetting) setUpiName(upiNameSetting.setting_value || '');
    }

    // Load pending deposit requests with user info
    const { data: requestsData } = await supabase
      .from('manual_deposit_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (requestsData && requestsData.length > 0) {
      // Fetch user profiles
      const userIds = [...new Set(requestsData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      
      const requestsWithProfiles = requestsData.map(req => ({
        ...req,
        profiles: profiles?.find(p => p.id === req.user_id)
      }));
      setDepositRequests(requestsWithProfiles);
    } else {
      setDepositRequests([]);
    }

    setLoading(false);
  };

  const getSetting = (key: string) => settings.find(s => s.setting_key === key);

  const updateSetting = async (key: string, value: string | null, isEnabled?: boolean) => {
    const existing = getSetting(key);
    
    if (existing) {
      await supabase
        .from('payment_settings')
        .update({ 
          setting_value: value,
          ...(isEnabled !== undefined && { is_enabled: isEnabled })
        })
        .eq('id', existing.id);
    }
    
    loadData();
  };

  const toggleAutoPayment = async () => {
    const current = getSetting('automatic_payment');
    await updateSetting('automatic_payment', current?.setting_value || null, !current?.is_enabled);
    toast.success(current?.is_enabled ? 'Auto payment disabled' : 'Auto payment enabled');
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `payment-qr-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-assets')
        .getPublicUrl(fileName);

      await updateSetting('manual_payment_qr', publicUrl, true);
      toast.success('QR code uploaded successfully');
    } catch (error: any) {
      toast.error('Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const savePaymentLink = async () => {
    await updateSetting('manual_payment_link', paymentLink, true);
    toast.success('Payment link saved');
  };

  const saveInstructions = async () => {
    await updateSetting('manual_payment_instructions', instructions, true);
    toast.success('Instructions saved');
  };

  const saveUpiDetails = async () => {
    // Insert or update UPI settings
    const upiIdSetting = getSetting('upi_id');
    const upiNameSetting = getSetting('upi_name');

    if (upiIdSetting) {
      await supabase
        .from('payment_settings')
        .update({ setting_value: upiId, is_enabled: true })
        .eq('id', upiIdSetting.id);
    } else {
      await supabase.from('payment_settings').insert({
        setting_key: 'upi_id',
        setting_value: upiId,
        is_enabled: true
      });
    }

    if (upiNameSetting) {
      await supabase
        .from('payment_settings')
        .update({ setting_value: upiName, is_enabled: true })
        .eq('id', upiNameSetting.id);
    } else {
      await supabase.from('payment_settings').insert({
        setting_key: 'upi_name',
        setting_value: upiName,
        is_enabled: true
      });
    }

    toast.success('UPI details saved');
    loadData();
  };

  const handleApproveRequest = async () => {
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
        
        // Check if user should get blue tick
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

      toast.success('Deposit approved');
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      loadData();
    } catch (error) {
      toast.error('Failed to approve deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRequest = async () => {
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
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminNote('');
      loadData();
    } catch (error) {
      toast.error('Failed to reject deposit');
    } finally {
      setProcessing(false);
    }
  };

  const qrSetting = getSetting('manual_payment_qr');
  const autoPaymentSetting = getSetting('automatic_payment');
  const pendingRequests = depositRequests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto Payment Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Automatic Payment (Razorpay)</h3>
              <p className="text-sm text-muted-foreground">
                {autoPaymentSetting?.is_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          <Switch
            checked={autoPaymentSetting?.is_enabled ?? true}
            onCheckedChange={toggleAutoPayment}
          />
        </div>
      </motion.div>

      {/* QR Code Upload */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-secondary/10">
            <QrCode className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Payment QR Code</h3>
            <p className="text-sm text-muted-foreground">Upload QR for manual payments</p>
          </div>
        </div>

        {qrSetting?.setting_value && (
          <div className="mb-4 flex justify-center">
            <img 
              src={qrSetting.setting_value} 
              alt="Payment QR" 
              className="w-40 h-40 object-contain rounded-xl border"
            />
          </div>
        )}

        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={handleQRUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            className="w-full rounded-xl"
            disabled={uploading}
            asChild
          >
            <span className="cursor-pointer">
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {qrSetting?.setting_value ? 'Change QR Code' : 'Upload QR Code'}
            </span>
          </Button>
        </label>
      </motion.div>

      {/* Payment Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-accent/10">
            <LinkIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Payment Link</h3>
            <p className="text-sm text-muted-foreground">Alternative payment URL</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://razorpay.me/@your-link"
            className="rounded-xl"
          />
          <Button onClick={savePaymentLink} className="rounded-xl">
            Save
          </Button>
        </div>
      </motion.div>

      {/* UPI Dynamic QR Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-success/10">
            <QrCode className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Dynamic UPI QR</h3>
            <p className="text-sm text-muted-foreground">Auto-generate QR with amount</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">UPI ID</label>
            <Input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="example@upi"
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Payee Name</label>
            <Input
              value={upiName}
              onChange={(e) => setUpiName(e.target.value)}
              placeholder="Your Name"
              className="rounded-xl"
            />
          </div>
          <Button onClick={saveUpiDetails} className="w-full rounded-xl">
            Save UPI Details
          </Button>
          
          {upiId && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg break-all">
              Preview: upi://pay?pa={upiId}&pn={encodeURIComponent(upiName)}&am=100
            </p>
          )}
        </div>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-success/10">
            <Settings className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Payment Instructions</h3>
            <p className="text-sm text-muted-foreground">Shown to users during manual deposit</p>
          </div>
        </div>

        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enter payment instructions..."
          className="rounded-xl mb-2"
          rows={3}
        />
        <Button onClick={saveInstructions} className="w-full rounded-xl">
          Save Instructions
        </Button>
      </motion.div>

      {/* Pending Deposit Requests */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-2xl p-4 shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Deposit Requests</h3>
              <p className="text-sm text-muted-foreground">{pendingRequests.length} pending</p>
            </div>
          </div>
        </div>

        {depositRequests.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No deposit requests yet
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {depositRequests.map((request) => (
              <div
                key={request.id}
                className={`p-3 rounded-xl border cursor-pointer transition-colors hover:bg-muted/50 ${
                  request.status === 'pending' ? 'border-warning/50 bg-warning/5' :
                  request.status === 'approved' ? 'border-success/50 bg-success/5' :
                  'border-destructive/50 bg-destructive/5'
                }`}
                onClick={() => {
                  setSelectedRequest(request);
                  setShowRequestModal(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {request.profiles?.name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      TXN: {request.transaction_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">₹{request.amount}</p>
                    <div className="flex items-center gap-1">
                      {request.status === 'pending' ? (
                        <Clock className="w-3 h-3 text-warning" />
                      ) : request.status === 'approved' ? (
                        <CheckCircle className="w-3 h-3 text-success" />
                      ) : (
                        <XCircle className="w-3 h-3 text-destructive" />
                      )}
                      <span className="text-xs capitalize">{request.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-sm mx-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Deposit Request</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">User</span>
                  <span className="font-medium">{selectedRequest.profiles?.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-sm">{selectedRequest.profiles?.email}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-lg">₹{selectedRequest.amount}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-sm">{selectedRequest.transaction_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-sm">
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Admin note (optional)"
                    className="rounded-xl"
                  />

                  <div className="flex gap-3">
                    <Button
                      onClick={handleRejectRequest}
                      variant="destructive"
                      className="flex-1 rounded-xl"
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                      Reject
                    </Button>
                    <Button
                      onClick={handleApproveRequest}
                      className="flex-1 rounded-xl bg-success hover:bg-success/90"
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                  </div>
                </>
              )}

              {selectedRequest.status !== 'pending' && (
                <div className={`p-3 rounded-xl flex items-center gap-2 ${
                  selectedRequest.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {selectedRequest.status === 'approved' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="capitalize font-medium">{selectedRequest.status}</span>
                  {selectedRequest.admin_note && (
                    <span className="text-sm ml-2">- {selectedRequest.admin_note}</span>
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

export default AdminPaymentSettings;
