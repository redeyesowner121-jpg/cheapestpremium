export interface Order {
  id: string;
  product_name: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  user_id?: string;
  discount_applied?: number;
  product_id?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  category: string;
  stock?: number | null;
  original_price?: number;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  total_deposit?: number;
  wallet_balance?: number;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  description?: string;
}

export interface AnalyticsData {
  orders: Order[];
  products: Product[];
  users: User[];
  transactions: Transaction[];
  selectedPeriod?: '7d' | '30d' | 'all';
}
