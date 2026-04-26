import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Shield } from 'lucide-react';

interface AdminNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const AdminNavigation: React.FC<AdminNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onTabChange('overview')}
        className={`relative overflow-hidden rounded-3xl p-6 transition-all ${
          activeTab === 'overview'
            ? 'bg-gradient-to-br from-primary via-primary/90 to-accent shadow-lg shadow-primary/25'
            : 'bg-card border border-border hover:border-primary/50 hover:shadow-md'
        }`}
      >
        <div className={`flex flex-col items-center gap-3 ${activeTab === 'overview' ? 'text-primary-foreground' : 'text-foreground'}`}>
          <div className={`p-4 rounded-2xl ${activeTab === 'overview' ? 'bg-white/20' : 'bg-primary/10'}`}>
            <TrendingUp className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold">Analytics</h3>
            <p className={`text-sm mt-1 ${activeTab === 'overview' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              Overview & Reports
            </p>
          </div>
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onTabChange('control')}
        className={`relative overflow-hidden rounded-3xl p-6 transition-all ${
          activeTab === 'control'
            ? 'bg-gradient-to-br from-secondary via-secondary/90 to-accent shadow-lg shadow-secondary/25'
            : 'bg-card border border-border hover:border-secondary/50 hover:shadow-md'
        }`}
      >
        <div className={`flex flex-col items-center gap-3 ${activeTab === 'control' ? 'text-secondary-foreground' : 'text-foreground'}`}>
          <div className={`p-4 rounded-2xl ${activeTab === 'control' ? 'bg-white/20' : 'bg-secondary/10'}`}>
            <Shield className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold">Control</h3>
            <p className={`text-sm mt-1 ${activeTab === 'control' ? 'text-secondary-foreground/70' : 'text-muted-foreground'}`}>
              Manage Everything
            </p>
          </div>
        </div>
      </motion.button>

      <motion.button
    </div>
  );
};

export default AdminNavigation;
