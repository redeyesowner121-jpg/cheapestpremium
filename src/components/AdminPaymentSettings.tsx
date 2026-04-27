import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentSetting, loadPaymentSettings, upsertSetting, uploadPaymentQR } from './payment-settings/payment-actions';
import AutoPaymentSection from './payment-settings/AutoPaymentSection';
import QRUploadSection from './payment-settings/QRUploadSection';
import PaymentDetailsSections from './payment-settings/PaymentDetailsSections';

const AdminPaymentSettings: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [paymentLink, setPaymentLink] = useState('');
  const [instructions, setInstructions] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');

  const reload = async () => {
    setLoading(true);
    const data = await loadPaymentSettings();
    setSettings(data);
    setPaymentLink(data.find(s => s.setting_key === 'manual_payment_link')?.setting_value || '');
    setInstructions(data.find(s => s.setting_key === 'manual_payment_instructions')?.setting_value || '');
    setUpiId(data.find(s => s.setting_key === 'upi_id')?.setting_value || '');
    setUpiName(data.find(s => s.setting_key === 'upi_name')?.setting_value || '');
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const get = (key: string) => settings.find(s => s.setting_key === key);

  const update = async (key: string, value: string | null, isEnabled?: boolean) => {
    await upsertSetting(settings, key, value, isEnabled);
    reload();
  };

  const toggleAutoPayment = async () => {
    const cur = get('automatic_payment');
    await update('automatic_payment', cur?.setting_value || null, !cur?.is_enabled);
    toast.success(cur?.is_enabled ? 'Auto payment disabled' : 'Auto payment enabled');
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPaymentQR(file);
      await update('manual_payment_qr', url, true);
      toast.success('QR code uploaded successfully');
    } catch {
      toast.error('Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const saveUpi = async () => {
    await upsertSetting(settings, 'upi_id', upiId, true);
    await upsertSetting(settings, 'upi_name', upiName, true);
    toast.success('UPI details saved');
    reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AutoPaymentSection enabled={get('automatic_payment')?.is_enabled ?? true} onToggle={toggleAutoPayment} />
      <QRUploadSection qrUrl={get('manual_payment_qr')?.setting_value || null} uploading={uploading} onUpload={handleQRUpload} />
      <PaymentDetailsSections
        paymentLink={paymentLink} setPaymentLink={setPaymentLink}
        onSaveLink={async () => { await update('manual_payment_link', paymentLink, true); toast.success('Payment link saved'); }}
        upiId={upiId} setUpiId={setUpiId}
        upiName={upiName} setUpiName={setUpiName}
        onSaveUpi={saveUpi}
        instructions={instructions} setInstructions={setInstructions}
        onSaveInstructions={async () => { await update('manual_payment_instructions', instructions, true); toast.success('Instructions saved'); }}
      />
    </div>
  );
};

export default AdminPaymentSettings;
