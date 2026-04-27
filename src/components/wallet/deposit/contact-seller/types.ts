export type Step = 'country' | 'product' | 'amount' | 'confirm';

export interface ContactState {
  selectedCountry: string;
  selectedFlag: string;
  selectedProductName: string;
  depositAmount: string;
  currency: string;
  extraNote: string;
}

export const buildMessage = (state: ContactState, profile: any) => {
  const lines = [
    `🔹 *Deposit Request - No Binance*`,
    ``,
    `👤 *Name:* ${profile?.name || 'N/A'}`,
    `📧 *Email:* ${profile?.email || 'N/A'}`,
    `📱 *Phone:* ${profile?.phone || 'N/A'}`,
    `🌍 *Country:* ${state.selectedFlag} ${state.selectedCountry}`,
    ``,
    `🛒 *Want to buy:* ${state.selectedProductName || 'General Deposit'}`,
    `💰 *Deposit Amount:* ${state.depositAmount} ${state.currency}`,
  ];
  if (state.extraNote.trim()) lines.push(`📝 *Note:* ${state.extraNote}`);
  lines.push(``, `Please help me with an alternative payment method.`);
  return lines.join('%0A');
};
