import React from 'react';
import { Edit, Trash2, Copy, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { RedeemCode } from './types';

interface Props {
  redeemCode: RedeemCode;
  onEdit: (rc: RedeemCode) => void;
  onDelete: (id: string) => void;
  onToggle: (rc: RedeemCode) => void;
}

const RedeemCodeRow: React.FC<Props> = ({ redeemCode, onEdit, onDelete, onToggle }) => {
  const copyCode = () => {
    navigator.clipboard.writeText(redeemCode.code);
    toast.success('Copied to clipboard');
  };

  return (
    <div className={`bg-card rounded-xl p-4 border ${
      redeemCode.is_active ? 'border-success/30' : 'border-border opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyCode}
              className="flex items-center gap-1 font-mono font-bold text-lg text-success bg-success/10 px-2 py-1 rounded-lg hover:bg-success/20 transition-colors"
            >
              {redeemCode.code}
              <Copy className="w-3 h-3" />
            </button>
            <span className="text-sm font-bold text-primary">₹{redeemCode.amount}</span>
          </div>

          {redeemCode.description && (
            <p className="text-sm text-muted-foreground mt-1">{redeemCode.description}</p>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              {redeemCode.used_count}/{redeemCode.usage_limit} used
            </span>
            {redeemCode.expires_at && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Expires {new Date(redeemCode.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={redeemCode.is_active} onCheckedChange={() => onToggle(redeemCode)} />
          <Button size="sm" variant="ghost" onClick={() => onEdit(redeemCode)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(redeemCode.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RedeemCodeRow;
