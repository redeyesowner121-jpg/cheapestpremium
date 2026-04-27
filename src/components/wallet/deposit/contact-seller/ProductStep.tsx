import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  onSelect: (productName: string) => void;
}

export const ProductStep: React.FC<Props> = ({ onSelect }) => {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('products').select('id, name, price, image_url, category').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  }, [search, products]);

  return (
    <div className="flex flex-col flex-1 min-h-0 mt-2 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted border-0"
        />
      </div>

      <button
        onClick={() => onSelect('General Deposit (No specific product)')}
        className="w-full p-3 bg-primary/10 border border-primary/30 rounded-xl text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        💰 Just Deposit Money (No specific product)
      </button>

      <div className="space-y-1 overflow-y-auto max-h-[40vh] pr-1">
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product.name)}
            className="w-full p-3 rounded-xl text-left text-sm font-medium transition-colors flex items-center gap-3 bg-muted hover:bg-muted/80"
          >
            {product.image_url && (
              <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-foreground truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">₹{product.price} • {product.category}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
