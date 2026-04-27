import React from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactState, buildMessage } from './types';

interface Props {
  state: ContactState;
  profile: any;
  whatsappNumber: string;
  telegramUsername: string;
}

export const ConfirmStep: React.FC<Props> = ({ state, profile, whatsappNumber, telegramUsername }) => {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground truncate max-w-[180px]">{value}</span>
    </div>
  );

  return (
    <div className="mt-2 space-y-4">
      <div className="p-4 bg-muted rounded-2xl space-y-2 text-sm">
        <Row label="Name" value={profile?.name || 'N/A'} />
        <Row label="Email" value={profile?.email || 'N/A'} />
        <Row label="Phone" value={profile?.phone || 'N/A'} />
        <Row label="Country" value={`${state.selectedFlag} ${state.selectedCountry}`} />
        <Row label="Product" value={state.selectedProductName} />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-bold text-primary text-lg">{state.depositAmount} {state.currency}</span>
        </div>
        {state.extraNote && <Row label="Note" value={state.extraNote} />}
      </div>

      <div className="space-y-2">
        {whatsappNumber && (
          <Button
            onClick={() => {
              const msg = buildMessage(state, profile);
              window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, '_blank');
            }}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Contact on WhatsApp
          </Button>
        )}

        <Button
          onClick={() => {
            const msg = buildMessage(state, profile).replace(/%0A/g, '\n').replace(/\*/g, '');
            window.open(`https://t.me/${telegramUsername}?text=${encodeURIComponent(msg)}`, '_blank');
          }}
          variant="outline"
          className="w-full h-12 rounded-xl"
        >
          <Send className="w-5 h-5 mr-2" />
          Contact on Telegram
        </Button>
      </div>
    </div>
  );
};
