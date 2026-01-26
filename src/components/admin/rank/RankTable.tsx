import React from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import InlineEdit from './InlineEdit';
import { Rank } from './constants';

interface RankTableProps {
  ranks: Rank[];
  onQuickUpdate: (rankId: string, field: 'min_balance' | 'discount_percent', value: number) => Promise<void>;
  onMoveOrder: (id: string, direction: 'up' | 'down') => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit: (rank: Rank) => void;
  onDelete: (id: string) => void;
}

const RankTable: React.FC<RankTableProps> = ({
  ranks,
  onQuickUpdate,
  onMoveOrder,
  onToggleActive,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-1 font-medium text-muted-foreground">Rank</th>
            <th className="text-right py-2 px-1 font-medium text-muted-foreground">Min Balance</th>
            <th className="text-right py-2 px-1 font-medium text-muted-foreground">Discount %</th>
            <th className="text-center py-2 px-1 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {ranks.map((rank, index) => (
            <motion.tr
              key={rank.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`border-b border-border/50 ${!rank.is_active ? 'opacity-50' : ''}`}
            >
              <td className="py-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{rank.icon}</span>
                  <span className={`font-medium ${rank.color}`}>{rank.name}</span>
                  {!rank.is_active && (
                    <span className="text-[10px] px-1 py-0.5 bg-muted rounded">Off</span>
                  )}
                </div>
              </td>
              <td className="py-2 px-1 text-right">
                <InlineEdit
                  value={rank.min_balance}
                  onSave={(val) => onQuickUpdate(rank.id, 'min_balance', val)}
                  prefix="₹"
                  type="number"
                />
              </td>
              <td className="py-2 px-1 text-right">
                <InlineEdit
                  value={rank.discount_percent}
                  onSave={(val) => onQuickUpdate(rank.id, 'discount_percent', val)}
                  suffix="%"
                  type="number"
                  step="0.1"
                />
              </td>
              <td className="py-2 px-1">
                <div className="flex items-center justify-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => onMoveOrder(rank.id, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => onMoveOrder(rank.id, 'down')}
                    disabled={index === ranks.length - 1}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Switch
                    checked={rank.is_active}
                    onCheckedChange={() => onToggleActive(rank.id, rank.is_active)}
                    className="scale-75"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6"
                    onClick={() => onEdit(rank)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => onDelete(rank.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankTable;
