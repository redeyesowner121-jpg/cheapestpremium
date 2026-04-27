import React from 'react';
import { Wallet, CreditCard, ShoppingBag, Phone, Mail, Calendar, Hash, UserCheck, Star, Award, Shield, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export interface UserEditForm {
  name: string;
  email: string;
  phone: string;
  wallet_balance: string;
  total_deposit: string;
  total_orders: string;
  rank_balance: string;
  pending_balance: string;
}

interface Props {
  user: any;
  editMode: boolean;
  editForm: UserEditForm;
  setEditForm: (f: UserEditForm) => void;
  saving: boolean;
  onSave: () => void;
}

const InfoRow: React.FC<{
  icon: React.ReactNode; label: string; value: string | number;
  editMode: boolean; editForm: UserEditForm;
  setEditForm: (f: UserEditForm) => void;
  editable?: boolean; field?: keyof UserEditForm; type?: string;
}> = ({ icon, label, value, editMode, editForm, setEditForm, editable, field, type = 'text' }) => (
  <div className="flex items-center gap-3 py-2">
    <div className="text-muted-foreground w-5 flex-shrink-0">{icon}</div>
    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
    {editMode && editable && field ? (
      <Input
        type={type}
        value={editForm[field]}
        onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
        className="h-8 text-sm flex-1"
      />
    ) : (
      <span className="text-sm font-medium text-foreground flex-1 truncate">{value}</span>
    )}
  </div>
);

export const UserDetailsTab: React.FC<Props> = ({ user, editMode, editForm, setEditForm, saving, onSave }) => {
  const row = (props: Omit<React.ComponentProps<typeof InfoRow>, 'editMode' | 'editForm' | 'setEditForm'>) => (
    <InfoRow {...props} editMode={editMode} editForm={editForm} setEditForm={setEditForm} />
  );

  return (
    <div className="space-y-1 mt-3">
      {row({ icon: <Mail className="w-4 h-4" />, label: 'Name', value: user.name, editable: true, field: 'name' })}
      {row({ icon: <Mail className="w-4 h-4" />, label: 'Email', value: user.email })}
      {row({ icon: <Phone className="w-4 h-4" />, label: 'Phone', value: user.phone || 'Not set', editable: true, field: 'phone' })}
      <Separator />
      {row({ icon: <Wallet className="w-4 h-4" />, label: 'Balance', value: `₹${user.wallet_balance || 0}`, editable: true, field: 'wallet_balance', type: 'number' })}
      {row({ icon: <Wallet className="w-4 h-4" />, label: 'Pending', value: `₹${user.pending_balance || 0}`, editable: true, field: 'pending_balance', type: 'number' })}
      {row({ icon: <CreditCard className="w-4 h-4" />, label: 'Total Deposit', value: `₹${user.total_deposit || 0}`, editable: true, field: 'total_deposit', type: 'number' })}
      {row({ icon: <ShoppingBag className="w-4 h-4" />, label: 'Total Orders', value: user.total_orders || 0, editable: true, field: 'total_orders', type: 'number' })}
      {row({ icon: <Star className="w-4 h-4" />, label: 'Rank Balance', value: `₹${user.rank_balance || 0}`, editable: true, field: 'rank_balance', type: 'number' })}
      <Separator />
      {row({ icon: <Hash className="w-4 h-4" />, label: 'Referral Code', value: user.referral_code || 'None' })}
      {row({ icon: <UserCheck className="w-4 h-4" />, label: 'Referred By', value: user.referred_by || 'None' })}
      {row({ icon: <Calendar className="w-4 h-4" />, label: 'Joined', value: new Date(user.created_at).toLocaleDateString('en-IN') })}
      {row({ icon: <Award className="w-4 h-4" />, label: 'Blue Tick', value: user.has_blue_check ? '✅ Yes' : '❌ No' })}
      {row({ icon: <Shield className="w-4 h-4" />, label: 'Reseller', value: user.is_reseller ? '✅ Yes' : '❌ No' })}

      {editMode && (
        <Button onClick={onSave} disabled={saving} className="w-full btn-gradient rounded-xl mt-3">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </div>
  );
};
