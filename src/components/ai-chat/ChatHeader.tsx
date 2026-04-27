import React from 'react';
import { Sparkles, Search, Trash2, Maximize2, X } from 'lucide-react';

interface Props {
  isFullScreen: boolean;
  loading: boolean;
  userId: string | null;
  msgCount: number;
  totalWords: number;
  onSearchToggle: () => void;
  onClear: () => void;
  onExpand: () => void;
  onClose: () => void;
}

export const ChatHeader: React.FC<Props> = ({
  isFullScreen, loading, userId, msgCount, totalWords,
  onSearchToggle, onClear, onExpand, onClose,
}) => (
  <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground ${isFullScreen ? '' : 'rounded-t-2xl'}`}>
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary shadow-sm" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm">RKR AI</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary-foreground/15 font-medium">PRO</span>
        </div>
        <p className="text-[10px] opacity-70">
          {loading ? '✍️ Typing...' : !userId ? '🔐 Login to save history' : msgCount > 0 ? `${msgCount} msgs • ${totalWords} words` : 'Always online'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-0.5">
      <button onClick={onSearchToggle} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Search (Ctrl+K)">
        <Search className="w-3.5 h-3.5" />
      </button>
      {msgCount > 0 && (
        <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Clear chat">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onExpand} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors" title="Open full page">
        <Maximize2 className="w-4 h-4" />
      </button>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);
