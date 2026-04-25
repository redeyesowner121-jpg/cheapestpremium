import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowUpRight, ArrowDownLeft, Shield } from 'lucide-react';
import SendTab from './transfer/SendTab';
import ReceiveTab from './transfer/ReceiveTab';
import EscrowTab from './transfer/EscrowTab';
import PendingRequests from './transfer/PendingRequests';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail?: string;
  userName?: string;
  walletBalance: number;
  loading: boolean;
  onTransfer: (recipient: UserProfile, amount: string, note: string) => void;
}

const TransferDialog: React.FC<TransferDialogProps> = ({
  open, onOpenChange, userId, userEmail, userName, walletBalance, loading, onTransfer,
}) => {
  const [tab, setTab] = useState('send');

  useEffect(() => { if (open) setTab('send'); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Transfer</DialogTitle>
          <DialogDescription className="text-xs">
            Send, receive, or use Escrow for safe deals.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="px-5 pb-5">
          <TabsList className="grid grid-cols-3 w-full rounded-xl">
            <TabsTrigger value="send" className="rounded-lg gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Send
            </TabsTrigger>
            <TabsTrigger value="receive" className="rounded-lg gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Receive
            </TabsTrigger>
            <TabsTrigger value="escrow" className="rounded-lg gap-1">
              <Shield className="w-3.5 h-3.5" /> Escrow
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="send" className="m-0">
              <SendTab
                userId={userId} walletBalance={walletBalance}
                loading={loading}
                onTransfer={(r, a, n) => { onTransfer(r, a, n); onOpenChange(false); }}
                onClose={() => onOpenChange(false)}
              />
              <div className="mt-4">
                <PendingRequests userId={userId} />
              </div>
            </TabsContent>
            <TabsContent value="receive" className="m-0">
              <ReceiveTab userId={userId} email={userEmail} name={userName} />
            </TabsContent>
            <TabsContent value="escrow" className="m-0">
              <EscrowTab userId={userId} walletBalance={walletBalance} onClose={() => onOpenChange(false)} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TransferDialog;
