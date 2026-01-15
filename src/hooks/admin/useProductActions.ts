import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductForm {
  name: string;
  description: string;
  price: string;
  original_price: string;
  reseller_price: string;
  category: string;
  image_url: string;
  access_link: string;
  stock: string;
  is_active: boolean;
}

export async function handleAddProduct(
  productForm: ProductForm,
  pendingVariations: { name: string; price: string; reseller_price: string }[],
  onComplete: () => void
) {
  if (!productForm.name || !productForm.price || !productForm.category) {
    toast.error('Please fill required fields');
    return false;
  }
  
  const { data: newProduct, error } = await supabase.from('products').insert({
    name: productForm.name,
    description: productForm.description,
    price: parseFloat(productForm.price),
    original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
    reseller_price: productForm.reseller_price ? parseFloat(productForm.reseller_price) : null,
    category: productForm.category,
    image_url: productForm.image_url,
    access_link: productForm.access_link || null,
    stock: productForm.stock ? parseInt(productForm.stock) : null,
    is_active: productForm.is_active
  }).select().single();
  
  if (error || !newProduct) {
    toast.error('Failed to add product');
    return false;
  }
  
  if (pendingVariations.length > 0) {
    const variationsToInsert = pendingVariations.map(v => ({
      product_id: newProduct.id,
      name: v.name,
      price: parseFloat(v.price),
      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
    }));
    
    await supabase.from('product_variations').insert(variationsToInsert);
  }
  
  toast.success('Product added!');
  onComplete();
  return true;
}

export async function handleUpdateProduct(
  productId: string,
  productForm: ProductForm,
  pendingVariations: { name: string; price: string; reseller_price: string }[],
  onComplete: () => void
) {
  if (!productForm.name || !productForm.price || !productForm.category) {
    toast.error('Please fill required fields');
    return false;
  }
  
  const { error } = await supabase.from('products').update({
    name: productForm.name,
    description: productForm.description,
    price: parseFloat(productForm.price),
    original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
    reseller_price: productForm.reseller_price ? parseFloat(productForm.reseller_price) : null,
    category: productForm.category,
    image_url: productForm.image_url,
    access_link: productForm.access_link || null,
    stock: productForm.stock ? parseInt(productForm.stock) : null,
    is_active: productForm.is_active
  }).eq('id', productId);
  
  if (error) {
    toast.error('Failed to update product');
    return false;
  }
  
  if (pendingVariations.length > 0) {
    const variationsToInsert = pendingVariations.map(v => ({
      product_id: productId,
      name: v.name,
      price: parseFloat(v.price),
      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
    }));
    
    await supabase.from('product_variations').insert(variationsToInsert);
  }
  
  toast.success('Product updated!');
  onComplete();
  return true;
}

export async function handleDeleteProduct(productId: string, onComplete: () => void) {
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId);
  
  if (orderCount && orderCount > 0) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);
    
    if (error) {
      toast.error('Failed to deactivate product');
      return false;
    }
    toast.success('Product deactivated (has existing orders)');
  } else {
    await supabase.from('product_variations').delete().eq('product_id', productId);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      toast.error('Failed to delete product');
      return false;
    }
    toast.success('Product deleted!');
  }
  
  onComplete();
  return true;
}

export async function handleAddVariation(
  productId: string,
  name: string,
  price: string,
  resellerPrice?: string,
  onComplete?: () => void
) {
  if (!name || !price) {
    toast.error('Please fill variation name and price');
    return false;
  }
  
  const { error } = await supabase.from('product_variations').insert({
    product_id: productId,
    name,
    price: parseFloat(price),
    reseller_price: resellerPrice ? parseFloat(resellerPrice) : null
  });

  if (error) {
    toast.error('Failed to add variation');
    return false;
  }

  toast.success('Variation added!');
  onComplete?.();
  return true;
}

export async function handleDeleteVariation(variationId: string, onComplete?: () => void) {
  await supabase.from('product_variations').delete().eq('id', variationId);
  toast.success('Variation deleted!');
  onComplete?.();
  return true;
}
