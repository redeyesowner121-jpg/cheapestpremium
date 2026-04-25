import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';

interface QrScannerProps {
  onScan: (decoded: string) => void;
  onError?: (msg: string) => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScan, onError }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

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

  return (
    <div className="space-y-3">
      <div
        ref={elRef}
        className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
      />
      <p className="text-xs text-center text-muted-foreground">
        Point the camera at a Cheapest-Premium QR code
      </p>
    </div>
  );
};

export default QrScanner;
