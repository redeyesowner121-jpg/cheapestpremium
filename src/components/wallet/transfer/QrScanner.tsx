import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';

interface QrScannerProps {
  onScan: (decoded: string) => void;
  onError?: (msg: string) => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onError }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!elRef.current) return;
    const id = `qr-reader-${Math.random().toString(36).slice(2)}`;
    elRef.current.id = id;
    const scanner = new Html5Qrcode(id, /* verbose */ false);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onScan(decoded);
          scanner.stop().catch(() => {});
        },
        () => { /* per-frame errors ignored */ }
      )
      .catch((err) => {
        const msg = err?.message || 'Unable to access camera';
        toast.error(msg);
        onError?.(msg);
      });

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (handledRef.current) return;

    setScanning(true);
    try {
      // Stop live camera scanner first to free resources
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
      }
      // Use a fresh scanner instance for file scan
      const fileScanner = new Html5Qrcode(elRef.current!.id, false);
      const decoded = await fileScanner.scanFile(file, true);
      handledRef.current = true;
      onScan(decoded);
    } catch (err: any) {
      const msg = err?.message || 'No QR code found in image';
      toast.error(msg);
      onError?.(msg);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={elRef}
        className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
      />
      <p className="text-xs text-center text-muted-foreground">
        Point the camera at a Cheapest-Premium QR code
      </p>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-xl"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning}
      >
        {scanning ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning image...</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" />Upload QR from gallery</>
        )}
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        Choose a saved QR image from your device storage
      </p>
    </div>
  );
};

export default QrScanner;
