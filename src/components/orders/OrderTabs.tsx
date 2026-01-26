import React from 'react';

interface OrderTabsProps {
  activeTab: 'all' | 'pending' | 'completed';
  onTabChange: (tab: 'all' | 'pending' | 'completed') => void;
}

const OrderTabs: React.FC<OrderTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = ['all', 'pending', 'completed'] as const;

  return (
    <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab
              ? 'bg-card text-foreground shadow-card'
              : 'text-muted-foreground'
          }`}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
};

export default OrderTabs;
