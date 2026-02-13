import React, { useState } from 'react';
import { Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
}

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  walletBalance: number;
  loading: boolean;
  onTransfer: (recipient: UserProfile, amount: string, note: string) => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  open, onOpenChange, userId, walletBalance, loading, onTransfer
}) => {
  const [searchUser, setSearchUser] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const handleSearchUsers = async (query: string) => {
    setSearchUser(query);
    if (query.length < 2) { setFoundUsers([]); return; }
    setSearchingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, referral_code')
      .neq('id', userId)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,referral_code.ilike.%${query}%`)
      .limit(5);
    setFoundUsers(data || []);
    setSearchingUsers(false);
  };

  const handleSubmit = () => {
    if (!selectedRecipient) return;
    onTransfer(selectedRecipient, transferAmount, transferNote);
    setTransferAmount('');
    setTransferNote('');
    setSelectedRecipient(null);
    setSearchUser('');
    setFoundUsers([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedRecipient(null);
      setSearchUser('');
      setFoundUsers([]);
      setTransferAmount('');
      setTransferNote('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Send Money</DialogTitle>
          <DialogDescription>Transfer money to another user instantly</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!selectedRecipient ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, or referral code" value={searchUser}
                  onChange={(e) => handleSearchUsers(e.target.value)} className="pl-10 rounded-xl" />
              </div>
              {searchingUsers ? (
                <div className="text-center py-4 text-muted-foreground">Searching...</div>
              ) : foundUsers.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {foundUsers.map((u) => (
                    <button key={u.id} onClick={() => setSelectedRecipient(u)}
                      className="w-full flex items-center gap-3 p-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                        {u.name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{u.referral_code}</span>
                    </button>
                  ))}
                </div>
              ) : searchUser.length >= 2 ? (
                <div className="text-center py-4 text-muted-foreground">No users found</div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">Enter at least 2 characters to search</div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {selectedRecipient.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{selectedRecipient.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRecipient.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedRecipient(null)}>Change</Button>
              </div>
              <Input type="number" placeholder="Enter amount" value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="h-14 text-2xl text-center font-bold rounded-xl" />
              <Input placeholder="Add a note (optional)" value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)} className="rounded-xl" />
              <div className="text-center text-sm text-muted-foreground">
                Your balance: ₹{walletBalance.toFixed(2)}
              </div>
              <Button onClick={handleSubmit} className="w-full h-12 btn-gradient rounded-xl"
                disabled={loading || !transferAmount || parseFloat(transferAmount) <= 0}>
                {loading ? 'Sending...' : `Send ₹${transferAmount || '0'}`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferModal;
