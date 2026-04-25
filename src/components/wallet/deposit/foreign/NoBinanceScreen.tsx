import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { useAuth } from '@/contexts/AuthContext';

interface NoBinanceScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foreignCountry: string;
  foreignFlag: string;
  onBack: () => void;
}

export const NoBinanceScreen: React.FC<NoBinanceScreenProps> = ({
  open, onOpenChange, foreignCountry, foreignFlag, onBack,
}) => {
  const { settings } = useAppSettingsContext();
  const { profile } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader><DialogTitle>Contact Seller</DialogTitle></DialogHeader>
        <div className="mt-4 space-y-4 text-center">
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">{settings.binance_contact_message}</p>
          {settings.contact_whatsapp && (
            <Button
              onClick={() => {
                const msg = [
                  `🔹 *Deposit Request - No Binance*`, ``,
                  `👤 *Name:* ${profile?.name || 'N/A'}`,
                  `📧 *Email:* ${profile?.email || 'N/A'}`,
                  `📱 *Phone:* ${profile?.phone || 'N/A'}`,
                  `🌍 *Country:* ${foreignFlag} ${foreignCountry}`,
                  `💰 *Purpose:* I want to deposit money but I don't have Binance.`, ``,
                  `Please help me with an alternative payment method.`
                ].join('%0A');
                window.open(`https://wa.me/${settings.contact_whatsapp.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
              }}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl"
            >
              <MessageCircle className="w-5 h-5 mr-2" />Contact on WhatsApp
            </Button>
          )}
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full mt-2 rounded-xl">← Back</Button>
      </DialogContent>
    </Dialog>
  );
};
