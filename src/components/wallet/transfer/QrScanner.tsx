import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';

interface QrScannerProps {
  onScan: (decoded: string) => void;
  onError?: (msg: string) => void;
}

const safeStop = async (scanner: Html5Qrcode | null) => {
  if (!scanner) return;
  try {
    const state = scanner.getState?.();
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      await scanner.stop();
    }
  } catch {
    /* ignore */
  }
};

const QrScanner = React.forwardRef<HTMLDivElement, QrScannerProps>(({ onScan, onError }, _ref) => {
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
          safeStop(scanner);
        },
        () => { /* per-frame errors ignored */ }
      )
      .catch((err) => {
        const msg = err?.message || 'Unable to access camera';
        toast.error(msg);
        onError?.(msg);
      });

    return () => {
      safeStop(scanner).finally(() => {
        try { scanner.clear(); } catch { /* ignore */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (handledRef.current) return;

    setScanning(true);
    try {
      // Stop live camera scanner first to free the element
      await safeStop(scannerRef.current);
      const fileScanner = new Html5Qrcode(elRef.current!.id, false);
      let decoded: string | null = null;
      try {
        decoded = await fileScanner.scanFile(file, true);
      } catch {
        // Retry without the helper crop — works better on tight QR images
        try {
          decoded = await fileScanner.scanFile(file, false);
        } catch (err2) {
          throw err2;
        }
      }
      try { await fileScanner.clear(); } catch { /* ignore */ }
      if (!decoded) throw new Error('No QR code found in image');
      handledRef.current = true;
      onScan(decoded);
    } catch (err: any) {
      const raw = err?.message || String(err) || '';
      const friendly = /No MultiFormat Readers|No QR code found|not detect/i.test(raw)
        ? 'Could not read QR. Try a clearer/cropped image or use the live camera.'
        : raw;
      toast.error(friendly);
      onError?.(friendly);
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
