import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const LINK_TRUNCATE_LEN = 60;

interface Props {
  item: any;
  idx: number;
  onDelete: (id: string) => void;
}

const StockItemRow: React.FC<Props> = ({ item, idx, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.access_link?.length > LINK_TRUNCATE_LEN;

  return (
    <div className={`rounded-lg border px-3 py-2 ${item.is_used ? 'bg-muted/40 opacity-60' : 'bg-background'}`}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-6 shrink-0 text-xs">#{idx + 1}</span>
        <button
          type="button"
          onClick={() => isLong && setExpanded(!expanded)}
          className={`flex-1 text-left font-mono text-xs min-w-0 ${isLong ? 'cursor-pointer hover:text-primary' : ''}`}
        >
          {expanded || !isLong
            ? <span className="break-all whitespace-pre-wrap">{item.access_link}</span>
            : <span className="truncate block">{item.access_link.slice(0, LINK_TRUNCATE_LEN)}…</span>
          }
        </button>
        {isLong && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-muted-foreground shrink-0 p-0.5">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
        {item.is_used ? (
          <Badge variant="secondary" className="text-xs shrink-0">Used</Badge>
        ) : (
          <button onClick={() => onDelete(item.id)} className="text-destructive shrink-0 hover:bg-destructive/10 p-1 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StockItemRow;
