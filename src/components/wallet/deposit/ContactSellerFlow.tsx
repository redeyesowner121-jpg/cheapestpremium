import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { Step, ContactState } from './contact-seller/types';
import { CountryStep } from './contact-seller/CountryStep';
import { ProductStep } from './contact-seller/ProductStep';
import { AmountStep } from './contact-seller/AmountStep';
import { ConfirmStep } from './contact-seller/ConfirmStep';

interface ContactSellerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
}

const initialState: ContactState = {
  selectedCountry: '',
  selectedFlag: '',
  selectedProductName: '',
  depositAmount: '',
  currency: 'USD',
  extraNote: '',
};

export const ContactSellerFlow: React.FC<ContactSellerFlowProps> = ({ open, onOpenChange, onBack }) => {
  const { profile } = useAuth();
  const { settings } = useAppSettingsContext();

  const [step, setStep] = useState<Step>('country');
  const [state, setState] = useState<ContactState>(initialState);

  useEffect(() => {
    if (!open) {
      setStep('country');
      setState(initialState);
    }
  }, [open]);

  const patch = (p: Partial<ContactState>) => setState((s) => ({ ...s, ...p }));

  const handleBack = () => {
    if (step === 'country') onBack();
    else if (step === 'product') setStep('country');
    else if (step === 'amount') setStep('product');
    else if (step === 'confirm') setStep('amount');
  };

  const whatsappNumber = settings.contact_whatsapp?.replace(/[^0-9]/g, '') || '';
  const telegramUsername = (settings as any).support_telegram || 'Air1_Premium_bot';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button onClick={handleBack} className="p-1 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </button>
            {step === 'country' && 'Select Your Country'}
            {step === 'product' && 'What do you want to buy?'}
            {step === 'amount' && 'Deposit Amount'}
            {step === 'confirm' && 'Confirm & Contact'}
          </DialogTitle>
          <DialogDescription>
            {step === 'country' && 'Choose your country'}
            {step === 'product' && 'Search and select a product (optional)'}
            {step === 'amount' && 'Enter how much you want to deposit'}
            {step === 'confirm' && 'Review your details and contact seller'}
          </DialogDescription>
        </DialogHeader>

        {step === 'country' && (
          <CountryStep
            onSelect={(name, flag) => {
              patch({ selectedCountry: name, selectedFlag: flag });
              setStep('product');
            }}
          />
        )}

        {step === 'product' && (
          <ProductStep
            onSelect={(productName) => {
              patch({ selectedProductName: productName });
              setStep('amount');
            }}
          />
        )}

        {step === 'amount' && (
          <AmountStep state={state} setState={patch} onContinue={() => setStep('confirm')} />
        )}

        {step === 'confirm' && (
          <ConfirmStep state={state} profile={profile} whatsappNumber={whatsappNumber} telegramUsername={telegramUsername} />
        )}
      </DialogContent>
    </Dialog>
  );
};
