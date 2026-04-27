// ===== Resale Bot - UPI helpers =====

export const UPI_ID = "8900684167@ibl";
export const UPI_NAME = "Asif Ikbal Rubaiul Islam";

export function generatePayUrl(amount: number): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR`;
}

export function generateUpiQrUrl(amount: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatePayUrl(amount))}`;
}

export function generateFallbackQrUrl(amount: number): string {
  return `https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatePayUrl(amount))}`;
}
