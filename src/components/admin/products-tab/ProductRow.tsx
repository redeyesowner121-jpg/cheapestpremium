import React from 'react';
import { Edit, Trash2, Download, Package, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  product: any;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
  onOpenSeo: (p: any) => void;
}

export const ProductRow: React.FC<Props> = ({ product, onEdit, onDelete, onOpenSeo }) => (
  <div className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4">
    <img src={product.image_url || 'https://via.placeholder.com/64'} alt="" className="w-16 h-16 rounded-xl object-cover" />
    <div className="flex-1">
      <p className="font-semibold text-foreground">{product.name}</p>
      <p className="text-sm text-muted-foreground">{product.category}</p>
      <div className="flex items-center gap-2">
        <p className="text-primary font-bold">₹{product.price}</p>
        {product.original_price && (
          <p className="text-xs text-muted-foreground line-through">₹{product.original_price}</p>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1">
        {product.access_link && (
          <p className="text-xs text-success flex items-center gap-1">
            <Download className="w-3 h-3" />
            Instant
          </p>
        )}
        {product.stock !== null && (
          <p className={`text-xs flex items-center gap-1 ${
            product.stock === 0 ? 'text-destructive' :
            product.stock <= 10 ? 'text-accent' : 'text-muted-foreground'
          }`}>
            <Package className="w-3 h-3" />
            {product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{product.sold_count || 0} sold</p>
      </div>
    </div>
    <div className="flex gap-2">
      <Button size="icon" variant="outline" onClick={() => onOpenSeo(product)} title="SEO Tags">
        <Tags className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="outline" onClick={() => onEdit(product)}>
        <Edit className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="destructive" onClick={() => onDelete(product.id)}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
);
