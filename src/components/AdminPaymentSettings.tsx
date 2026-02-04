import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  QrCode, 
  Link as LinkIcon, 
  Upload, 
  Loader2,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
}

const AdminPaymentSettings: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  const qrSetting = getSetting('manual_payment_qr');
  const autoPaymentSetting = getSetting('automatic_payment');

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
            <label className="text-sm text-muted-foreground mb-1 block">Receiver Name (shown to users)</label>
            <Input
              value={upiName}
              onChange={(e) => setUpiName(e.target.value)}
              placeholder="Your Name / Business Name"
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
    </div>
  );
};

export default AdminPaymentSettings;
