import React, { useState, memo } from 'react';
import { TrendingUp } from 'lucide-react';
import AnalyticsTabs, { type AnalyticsTab } from './analytics/AnalyticsTabs';
import OverviewTab from './analytics/OverviewTab';
import WalletTab from './analytics/WalletTab';
import AnalysisTab from './analytics/AnalysisTab';
import SearchTab from './analytics/SearchTab';

interface Order {
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

interface Product {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  category: string;
  stock?: number | null;
  original_price?: number;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  total_deposit?: number;
  wallet_balance?: number;
  created_at?: string;
}

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  description?: string;
}

interface AdminAnalyticsProps {
  orders: Order[];
  products: Product[];
  users?: User[];
  transactions?: Transaction[];
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ orders, products, users = [], transactions = [] }) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('7d');

  const data = { orders, products, users, transactions, selectedPeriod };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Analytics Dashboard
        </h2>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(['7d', '30d', 'all'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedPeriod === period ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {period === '7d' ? '7D' : period === '30d' ? '30D' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <AnalyticsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && <OverviewTab {...data} />}
      {activeTab === 'wallet' && <WalletTab {...data} />}
      {activeTab === 'analysis' && <AnalysisTab {...data} />}
      {activeTab === 'search' && <SearchTab />}
    </div>
  );
};

export default memo(AdminAnalytics);
