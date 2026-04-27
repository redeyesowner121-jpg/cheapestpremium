import React from 'react';
import type { AnalyticsData } from './types';
import { useAnalyticsExtras } from './analysis/shared';
import { CombinedGraph } from './analysis/CombinedGraph';
import { ProductModules } from './analysis/ProductModules';
import { OrderUserModules } from './analysis/OrderUserModules';

const AnalysisTab: React.FC<AnalyticsData> = ({ orders, products, users, transactions, selectedPeriod = '7d' }) => {
  const { searchLogs, siteVisits } = useAnalyticsExtras();

  return (
    <div className="space-y-4">
      <CombinedGraph
        orders={orders}
        users={users}
        transactions={transactions}
        selectedPeriod={selectedPeriod}
        searchLogs={searchLogs}
        siteVisits={siteVisits}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <ProductModules products={products} orders={orders} />
        <OrderUserModules orders={orders} users={users} selectedPeriod={selectedPeriod} />
      </div>
    </div>
  );
};

export default AnalysisTab;
