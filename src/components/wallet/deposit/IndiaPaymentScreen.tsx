import React from 'react';
import { QrCode, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AutoFlow from './india/AutoFlow';
import ManualFlow from './india/ManualFlow';
import type { PaymentSettings } from './constants';

interface IndiaPaymentScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositAmount: string;
  onDepositAmountChange: (amount: string) => void;
  paymentSettings: PaymentSettings | null;
  loading: boolean;
  onAutoDeposit: () => void;
  onManualDeposit: () => void;
  submittingManual: boolean;
  transactionId: string;
  onTransactionIdChange: (id: string) => void;
  senderName: string;
  onSenderNameChange: (name: string) => void;
  depositTab: 'auto' | 'manual';
  onTabChange: (tab: 'auto' | 'manual') => void;
  onChangeCountry: () => void;
}

const IndiaPaymentScreen: React.FC<IndiaPaymentScreenProps> = ({
  open, onOpenChange, depositAmount, onDepositAmountChange,
  paymentSettings, onManualDeposit,
  submittingManual, transactionId, onTransactionIdChange,
  senderName, onSenderNameChange, depositTab, onTabChange, onChangeCountry,
}) => {
  const parsedAmount = depositAmount ? parseFloat(depositAmount) : 0;
  const showManualTab = parsedAmount > 20;

  React.useEffect(() => {
    if (!showManualTab && depositTab === 'manual') {
      onTabChange('auto');
    }
  }, [showManualTab, depositTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Add money to your wallet securely.</DialogDescription>
        </DialogHeader>

        <Tabs value={depositTab} onValueChange={(v) => onTabChange(v as any)} className="mt-4">
          <TabsList className={`grid w-full ${showManualTab ? 'grid-cols-2' : 'grid-cols-1'} rounded-xl`}>
            <TabsTrigger value="auto" className="rounded-lg text-xs">
              <Smartphone className="w-3.5 h-3.5 mr-1" />Auto
            </TabsTrigger>
            {showManualTab && (
              <TabsTrigger value="manual" className="rounded-lg text-xs">
                <QrCode className="w-3.5 h-3.5 mr-1" />Manual
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="auto" className="mt-4">
            <AutoFlow
              depositAmount={depositAmount}
              onDepositAmountChange={onDepositAmountChange}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <ManualFlow
              depositAmount={depositAmount}
              onDepositAmountChange={onDepositAmountChange}
              paymentSettings={paymentSettings}
              submittingManual={submittingManual}
              transactionId={transactionId}
              onTransactionIdChange={onTransactionIdChange}
              senderName={senderName}
              onSenderNameChange={onSenderNameChange}
              onManualDeposit={onManualDeposit}
            />
          </TabsContent>
        </Tabs>

        <Button variant="ghost" onClick={onChangeCountry} className="w-full mt-2 rounded-xl">← Change Country</Button>
      </DialogContent>
    </Dialog>
  );
};

export default IndiaPaymentScreen;
