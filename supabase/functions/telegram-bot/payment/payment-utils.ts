// ===== PAYMENT UTILITY HELPERS =====

// Default rate — used as fallback when settings aren't available
export const INR_TO_USD_RATE = 70;

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

export function inrToUsd(inrAmount: number, rate?: number): number {
  const r = rate || INR_TO_USD_RATE;
  const usd = inrAmount / r;
  return Math.max(0.01, Math.round(usd * 100) / 100);
}

export function usdToInr(usdAmount: number, rate?: number): number {
  const r = rate || INR_TO_USD_RATE;
  return Math.round(usdAmount * r);
}

/** Get the USD rate from app_settings, fallback to default */
export async function getDynamicUsdRate(supabase: any): Promise<number> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "usd_to_inr_rate")
      .maybeSingle();
    if (data?.value) {
      const rate = parseFloat(data.value);
      if (Number.isFinite(rate) && rate > 0) return rate;
    }
  } catch {}
  return INR_TO_USD_RATE;
}
