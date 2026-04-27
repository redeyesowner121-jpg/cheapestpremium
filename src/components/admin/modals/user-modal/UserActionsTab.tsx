import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, MessageCircle, Gift, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  user: any;
  onGiftBlueTick: (userId: string) => void;
  onGiftMoney: (amount: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const UserActionsTab: React.FC<Props> = ({ user, onGiftBlueTick, onGiftMoney, onClose, onRefresh }) => {
  const navigate = useNavigate();
  const [giftAmount, setGiftAmount] = useState('');

  return (
    <div className="space-y-3 mt-3">
      {!user.has_blue_check && (
        <Button onClick={() => onGiftBlueTick(user.id)} className="w-full btn-gradient rounded-xl">
          <Award className="w-4 h-4 mr-2" />
          Gift Blue Tick
        </Button>
      )}

      <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
        <span className="text-sm font-medium">💼 Reseller Status</span>
        <Switch
          checked={user.is_reseller || false}
          onCheckedChange={async (checked) => {
            await supabase.from('profiles').update({ is_reseller: checked }).eq('id', user.id);
            toast.success(checked ? 'Reseller activated!' : 'Reseller removed');
            onRefresh();
          }}
        />
      </div>

      <div className="flex gap-2">
        <Input type="number" placeholder="Amount (₹)" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="flex-1 rounded-xl" />
        <Button onClick={() => { onGiftMoney(giftAmount); setGiftAmount(''); }} className="rounded-xl">
          <Gift className="w-4 h-4 mr-2" />
          Gift
        </Button>
      </div>

      <Button variant="outline" className="w-full rounded-xl" onClick={() => { onClose(); navigate('/chat'); }}>
        <MessageCircle className="w-4 h-4 mr-2" />
        Send Message
      </Button>

      <Button
        variant="outline"
        className="w-full rounded-xl"
        onClick={async () => {
          const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'seller').maybeSingle();
          if (existingRole) {
            await supabase.from('user_roles').delete().eq('id', existingRole.id);
            toast.success('Seller role removed');
          } else {
            await supabase.from('user_roles').insert({ user_id: user.id, role: 'seller' });
            toast.success('Seller role added!');
          }
          onClose();
          onRefresh();
        }}
      >
        <Shield className="w-4 h-4 mr-2" />
        Toggle Seller Role
      </Button>
    </div>
  );
};
