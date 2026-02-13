import React, { useState } from 'react';
import { 
  LayoutDashboard, Wallet, BarChart3, Search, 
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'search', label: 'Search', icon: Search },
] as const;

export type AnalyticsTab = typeof TABS[number]['id'];

interface AnalyticsTabsProps {
  activeTab: AnalyticsTab;
  onChange: (tab: AnalyticsTab) => void;
}

const AnalyticsTabs: React.FC<AnalyticsTabsProps> = ({ activeTab, onChange }) => {
  return (
    <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default AnalyticsTabs;
