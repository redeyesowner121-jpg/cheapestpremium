// ===== PAYMENT UTILITY HELPERS =====

export const INR_TO_USD_RATE = 60;

export function generatePayUrl(upiId: string, upiName: string, amount: number): string {
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;
}

export function generateUpiQrUrl(upiId: string, upiName: string, amount: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatePayUrl(upiId, upiName, amount))}`;
}

export function generateFallbackQrUrl(upiId: string, upiName: string, amount: number): string {
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatePayUrl(upiId, upiName, amount))}`;
}

export function generatePaymentNote(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let note = '';
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 6) {
      note += digits[Math.floor(Math.random() * digits.length)];
    } else {
      note += letters[Math.floor(Math.random() * letters.length)];
    }
  }
  return note;
}

export function inrToUsd(inrAmount: number): number {
  const usd = inrAmount / INR_TO_USD_RATE;
  return Math.max(0.01, Math.round(usd * 100) / 100);
}
