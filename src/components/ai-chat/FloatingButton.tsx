import React from 'react';
import { motion } from 'framer-motion';
import { X, Bot } from 'lucide-react';

interface Props {
  btnPos: { x: number; y: number };
  msgCount: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onClick: () => void;
  onHide: () => void;
}

export const FloatingButton: React.FC<Props> = ({
  btnPos, msgCount, onPointerDown, onPointerMove, onPointerUp, onClick, onHide,
}) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    exit={{ scale: 0 }}
    className="fixed bottom-24 right-4 z-[60]"
    style={{ transform: `translate(${btnPos.x}px, ${btnPos.y}px)` }}
  >
    <div className="relative">
      <button
        onClick={onHide}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10"
        title="Hide AI"
      >
        <X className="w-3 h-3" />
      </button>
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform touch-none select-none cursor-grab active:cursor-grabbing relative ring-2 ring-primary/20"
      >
        <Bot className="w-6 h-6 pointer-events-none" />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background">
          <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse" />
        </span>
        {msgCount > 0 && (
          <span className="absolute -bottom-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center border-2 border-background">
            {msgCount > 99 ? '99+' : msgCount}
          </span>
        )}
      </button>
    </div>
  </motion.div>
);
