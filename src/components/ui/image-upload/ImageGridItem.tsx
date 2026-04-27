import React from 'react';
import { motion } from 'framer-motion';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  url: string;
  index: number;
  onSetPrimary: (i: number) => void;
  onRemove: (i: number) => void;
}

export const ImageGridItem: React.FC<Props> = ({ url, index, onSetPrimary, onRemove }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className={cn(
      'relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer',
      index === 0 ? 'border-primary' : 'border-border'
    )}
    onClick={() => onSetPrimary(index)}
  >
    <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
    {index === 0 && (
      <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
        Primary
      </div>
    )}
    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
      {index !== 0 && (
        <button
          type="button"
          className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
          onClick={(e) => { e.stopPropagation(); onSetPrimary(index); }}
        >
          <GripVertical className="w-3 h-3 text-white" />
        </button>
      )}
      <button
        type="button"
        className="p-1.5 bg-destructive/80 rounded-full hover:bg-destructive transition-colors"
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  </motion.div>
);
