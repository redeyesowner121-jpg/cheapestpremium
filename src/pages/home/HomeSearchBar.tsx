import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useHomeSearch } from './useHomeSearch';

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
  query: string;
  setQuery: (v: string) => void;
  onProductClick: (p: any) => void;
}

const HomeSearchBar: React.FC<Props> = ({ open, setOpen, query, setQuery, onProductClick }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading } = useHomeSearch(open ? query : '');

  return (
    <>
      <div className="-mx-4 px-4 py-1">
        {open ? (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  navigate('/products', { state: { searchQuery: query.trim() } });
                }
              }}
              placeholder="Search products..."
              className="w-full pl-12 pr-12 py-3.5 rounded-2xl gradient-primary text-white placeholder-white/60 text-sm font-medium outline-none shadow-colored-primary"
            />
            <button onClick={() => { setOpen(false); setQuery(''); }} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl gradient-primary hover:opacity-95 transition-all active:scale-[0.98] shadow-colored-primary"
          >
            <Search className="w-5 h-5 text-white" />
            <span className="text-white/90 text-sm font-medium">Search products...</span>
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            results.map(product => (
              <button key={product.id} onClick={() => onProductClick(product)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow text-left">
                <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-xs text-primary font-semibold">₹{product.price}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">No products found</p>
          )}
        </div>
      )}
    </>
  );
};

export default React.memo(HomeSearchBar);
