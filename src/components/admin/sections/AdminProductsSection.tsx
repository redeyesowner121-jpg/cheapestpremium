import React, { useState } from 'react';
import { Search, Plus, Edit, Tags, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminProductsSectionProps {
  products: any[];
  onAddProduct: () => void;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (productId: string) => void;
  onDataChange: () => void;
}

const AdminProductsSection: React.FC<AdminProductsSectionProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onDataChange,
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [seoProduct, setSeoProduct] = useState<any>(null);
  const [seoTags, setSeoTags] = useState('');
  const [savingSeo, setSavingSeo] = useState(false);

  const filteredProducts = products.filter(p =>
    productSearch === '' ||
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSaveSeo = async () => {
    if (!seoProduct) return;
    setSavingSeo(true);
    const { error } = await supabase
      .from('products')
      .update({ seo_tags: seoTags.trim() || null })
      .eq('id', seoProduct.id);
    setSavingSeo(false);
    if (error) {
      toast.error('Failed to save SEO tags');
      return;
    }
    toast.success('SEO tags updated!');
    setSeoProduct(null);
    onDataChange();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Button onClick={onAddProduct} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredProducts.map((product: any) => (
            <div
              key={product.id}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
            >
              <img src={product.image_url || '/placeholder.svg'} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category}</p>
              </div>
              <div className="text-right mr-2">
                <p className="font-bold text-foreground">₹{product.price}</p>
                <p className="text-xs text-muted-foreground">Stock: {product.stock ?? '∞'}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => onEditProduct(product)} className="h-8 w-8">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setSeoProduct(product); setSeoTags(product.seo_tags || ''); }} className="h-8 w-8" title="SEO Tags">
                  <Tags className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDeleteProduct(product.id)} className="h-8 w-8 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SEO Tags Modal */}
      <Dialog open={!!seoProduct} onOpenChange={(open) => !open && setSeoProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SEO Tags - {seoProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">কমা দিয়ে আলাদা করে ট্যাগ লিখুন (e.g. netflix, premium, ott)</p>
            <Textarea
              value={seoTags}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSeoTags(e.target.value)}
              placeholder="tag1, tag2, tag3..."
              rows={3}
            />
            <Button className="w-full" onClick={handleSaveSeo} disabled={savingSeo}>
              {savingSeo ? 'Saving...' : 'Save SEO Tags'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminProductsSection;
