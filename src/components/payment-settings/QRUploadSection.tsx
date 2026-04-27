import React from 'react';
import { motion } from 'framer-motion';
import { QrCode, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  qrUrl: string | null;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const QRUploadSection: React.FC<Props> = ({ qrUrl, uploading, onUpload }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
    className="bg-card rounded-2xl p-4 shadow-card">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-secondary/10">
        <QrCode className="w-5 h-5 text-secondary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">Payment QR Code</h3>
        <p className="text-sm text-muted-foreground">Upload QR for manual payments</p>
      </div>
    </div>
    {qrUrl && (
      <div className="mb-4 flex justify-center">
        <img src={qrUrl} alt="Payment QR" className="w-40 h-40 object-contain rounded-xl border" />
      </div>
    )}
    <label className="block">
      <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
      <Button variant="outline" className="w-full rounded-xl" disabled={uploading} asChild>
        <span className="cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {qrUrl ? 'Change QR Code' : 'Upload QR Code'}
        </span>
      </Button>
    </label>
  </motion.div>
);

export default QRUploadSection;
