import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function triggerProductSync(type: 'product' | 'category', action: 'create' | 'update' | 'delete', data?: any) {
  try {
    const syncUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-products-webhook`;
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type, action, data }),
    });

    if (!response.ok) {
      console.error('Sync webhook failed:', response.status);
    }
  } catch (error) {
    console.error('Failed to trigger sync webhook:', error);
  }
}

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
  button_style?: string;
}

export async function handleAddProduct(
  productForm: ProductForm,
  pendingVariations: { name: string; price: string; original_price: string; reseller_price: string }[],
  onComplete: () => void
) {
  if (!productForm.name || !productForm.image_url || !productForm.category) {
    toast.error('Product Name, Image URL ও Category অবশ্যই পূরণ করুন');
    return false;
  }
  
  // Generate clean slug from product name
  const baseSlug = productForm.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || 'product';
  
  const { data: existing } = await supabase.from('products').select('slug').like('slug', `${baseSlug}%`);
  const existingSlugs = new Set((existing || []).map((p: any) => p.slug));
  let productSlug = baseSlug;
  if (existingSlugs.has(productSlug)) {
    let counter = 2;
    while (existingSlugs.has(`${baseSlug}-${counter}`)) counter++;
    productSlug = `${baseSlug}-${counter}`;
  }

  // Use first variation price as main product price
  const mainPrice = pendingVariations.length > 0 && pendingVariations[0].price
    ? parseFloat(pendingVariations[0].price)
    : (productForm.price ? parseFloat(productForm.price) : 0);

  const { data: newProduct, error } = await supabase.from('products').insert({
    name: productForm.name,
    description: productForm.description,
    price: mainPrice,
    original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
    reseller_price: productForm.reseller_price ? parseFloat(productForm.reseller_price) : null,
    category: productForm.category,
    image_url: productForm.image_url,
    access_link: productForm.access_link || null,
    stock: productForm.stock ? parseInt(productForm.stock) : null,
    is_active: productForm.is_active,
    slug: productSlug,
    button_style: productForm.button_style || 'primary'
  } as any).select().single();
  
  if (error || !newProduct) {
    toast.error('Failed to add product');
    return false;
  }

  if (pendingVariations.length > 0) {
    const variationsToInsert = pendingVariations.map(v => ({
      product_id: newProduct.id,
      name: v.name,
      price: parseFloat(v.price),
      original_price: v.original_price ? parseFloat(v.original_price) : null,
      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
    }));

    await supabase.from('product_variations').insert(variationsToInsert);
  }

  toast.success('Product added!');
  await triggerProductSync('product', 'create', { id: newProduct.id, name: newProduct.name });
  onComplete();
  return true;
}

export async function handleUpdateProduct(
  productId: string,
  productForm: ProductForm,
  pendingVariations: { name: string; price: string; original_price: string; reseller_price: string }[],
  onComplete: () => void
) {
  if (!productForm.name || !productForm.image_url || !productForm.category) {
    toast.error('Product Name, Image URL ও Category অবশ্যই পূরণ করুন');
    return false;
  }
  
  // Fetch existing variations to use first one's price as main price
  const { data: existingVars } = await supabase.from('product_variations').select('price')
    .eq('product_id', productId).order('created_at', { ascending: true }).limit(1);
  
  const firstVarPrice = existingVars?.[0]?.price ?? (pendingVariations.length > 0 && pendingVariations[0].price ? parseFloat(pendingVariations[0].price) : null);
  const mainPrice = firstVarPrice ?? (productForm.price ? parseFloat(productForm.price) : 0);

  const { data: updatedProduct, error } = await supabase.from('products').update({
    name: productForm.name,
    description: productForm.description,
    price: mainPrice,
    original_price: productForm.original_price ? parseFloat(productForm.original_price) : null,
    reseller_price: productForm.reseller_price ? parseFloat(productForm.reseller_price) : null,
    category: productForm.category,
    image_url: productForm.image_url,
    access_link: productForm.access_link || null,
    stock: productForm.stock ? parseInt(productForm.stock) : null,
    is_active: productForm.is_active,
    button_style: productForm.button_style || 'primary'
  } as any).eq('id', productId).select().single();

  if (error) {
    toast.error('Failed to update product');
    return false;
  }

  if (pendingVariations.length > 0) {
    const variationsToInsert = pendingVariations.map(v => ({
      product_id: productId,
      name: v.name,
      price: parseFloat(v.price),
      original_price: v.original_price ? parseFloat(v.original_price) : null,
      reseller_price: v.reseller_price ? parseFloat(v.reseller_price) : null
    }));

    await supabase.from('product_variations').insert(variationsToInsert);
  }

  toast.success('Product updated!');
  if (updatedProduct) {
    await triggerProductSync('product', 'update', { id: updatedProduct.id, name: updatedProduct.name });
  }
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
    await triggerProductSync('product', 'update', { id: productId });
  } else {
    await supabase.from('product_variations').delete().eq('product_id', productId);
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      toast.error('Failed to delete product');
      return false;
    }
    toast.success('Product deleted!');
    await triggerProductSync('product', 'delete', { id: productId });
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
