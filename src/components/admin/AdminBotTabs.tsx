import React, { useState } from 'react';
import { Bot, Gift, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminTelegramBot from './AdminTelegramBot';
import GiveawayBotManager from './GiveawayBotManager';
import MotherBotManager from './MotherBotManager';

const AdminBotTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'selling' | 'giveaway' | 'mother'>('selling');

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-2xl">
        <Button
          variant={activeTab === 'selling' ? 'default' : 'ghost'}
          className="flex-1 rounded-xl gap-2"
          onClick={() => setActiveTab('selling')}
        >
          <Bot className="w-4 h-4" />
          Selling Bot
        </Button>
        <Button
          variant={activeTab === 'giveaway' ? 'default' : 'ghost'}
          className="flex-1 rounded-xl gap-2"
          onClick={() => setActiveTab('giveaway')}
        >
          <Gift className="w-4 h-4" />
          Giveaway
        </Button>
        <Button
          variant={activeTab === 'mother' ? 'default' : 'ghost'}
          className="flex-1 rounded-xl gap-2"
          onClick={() => setActiveTab('mother')}
        >
          <Factory className="w-4 h-4" />
          Mother Bot
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'selling' && <AdminTelegramBot />}
      {activeTab === 'giveaway' && <GiveawayBotManager />}
      {activeTab === 'mother' && <MotherBotManager />}
    </div>
  );
};

export default AdminBotTabs;
