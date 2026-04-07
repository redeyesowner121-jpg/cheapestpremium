export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  rating: number;
  sold_count: number;
  category: string;
  access_link?: string;
  reseller_price?: number;
  seo_tags?: string;
  created_at?: string;
}

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
}

export interface CategoryItem {
  id: string;
  name: string;
}
