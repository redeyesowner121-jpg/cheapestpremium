import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Search, Package, Pencil, Loader2,
  Eye, EyeOff, Filter, Layers, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

const ProductEditListPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isTempAdmin } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    if (!(isAdmin || isTempAdmin)) { navigate('/'); return; }
    loadProducts();
  }, [isAdmin, isTempAdmin]);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('id, name, slug, image_url, category, price, is_active, stock, delivery_mode, sold_count')
      .order('created_at', { ascending: false });
    setProducts(data || []);
    const cats = [...new Set((data || []).map((p: any) => p.category).filter(Boolean))];
    setCategories(cats);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    return list;
  }, [products, search, categoryFilter]);

  const getImageUrl = (img: string) => {
    if (!img) return '';
    try { const p = JSON.parse(img); return Array.isArray(p) ? p[0] : img; } catch { return img; }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground">Edit Products</h1>
              <p className="text-xs text-muted-foreground">{filtered.length} of {products.length} products</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-xl h-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px] rounded-xl h-10">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Product list */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((product, i) => {
            const imgUrl = getImageUrl(product.image_url);
            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <button
                  onClick={() => navigate(`/edit/${product.slug}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/[0.03] transition-all group text-left active:scale-[0.98]"
                >
                  {/* Image */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 relative">
                    {imgUrl ? (
                      <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                    )}
                    {!product.is_active && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-primary">₹{product.price}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{product.category}</Badge>
                      {product.delivery_mode === 'unique' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                          <Layers className="w-2.5 h-2.5" /> Auto
                        </Badge>
                      )}
                      {product.sold_count > 0 && (
                        <span className="text-[10px] text-muted-foreground">{product.sold_count} sold</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center gap-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No products found</p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
};

export default ProductEditListPage;
