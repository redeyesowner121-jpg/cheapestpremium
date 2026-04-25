import React, { useState } from 'react';
import { Gift, Package, Users, Award, Settings, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGiveawayBotData } from './giveaway/useGiveawayBotData';
import { OverviewTab } from './giveaway/OverviewTab';
import { ProductsTab } from './giveaway/ProductsTab';
import { UsersTab, RedemptionsTab, ChannelsTab, SettingsTab } from './giveaway/SimpleTabs';
import { GiveawayUserModal } from './giveaway/GiveawayUserModal';

type Tab = 'overview' | 'products' | 'users' | 'redemptions' | 'channels' | 'settings';

const GIVEAWAY_CHANNELS = ['@rkrxott', '@rkrxmethods'];

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Gift },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'redemptions', label: 'Redemptions', icon: Award },
  { key: 'channels', label: 'Channels', icon: Radio },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const GiveawayBotManager: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const data = useGiveawayBotData();

  const handleUserClick = async (tgId: number) => {
    const detail = await data.viewUserDetail(tgId);
    setSelectedUser(detail);
    setShowUserModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'ghost'}
            className="rounded-xl gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          stats={data.stats} topUsers={data.topUsers}
          channelCount={GIVEAWAY_CHANNELS.length}
          loading={data.loading} onRefresh={data.fetchData}
          onUserClick={handleUserClick}
        />
      )}

      {tab === 'products' && (
        <ProductsTab
          products={data.products}
          giveawayProducts={data.giveawayProducts}
          variations={data.variations}
          selectedProduct={data.selectedProduct}
          selectedVariation={data.selectedVariation}
          pointsRequired={data.pointsRequired}
          stock={data.stock}
          productSearch={data.productSearch}
          productDropdownOpen={data.productDropdownOpen}
          filteredProducts={data.filteredProducts}
          selectedProductName={data.selectedProductName}
          onSelectedProductChange={data.setSelectedProduct}
          onSelectedVariationChange={data.setSelectedVariation}
          onPointsRequiredChange={data.setPointsRequired}
          onStockChange={data.setStock}
          onProductSearchChange={data.setProductSearch}
          onProductDropdownOpenChange={data.setProductDropdownOpen}
          onAdd={data.addGiveawayProduct}
          onRemove={data.removeGiveawayProduct}
          onToggleActive={data.toggleActive}
        />
      )}

      {tab === 'users' && <UsersTab topUsers={data.topUsers} onUserClick={handleUserClick} />}
      {tab === 'redemptions' && <RedemptionsTab redemptions={data.redemptions} />}
      {tab === 'channels' && <ChannelsTab channels={GIVEAWAY_CHANNELS} />}
      {tab === 'settings' && (
        <SettingsTab
          pointsPerReferral={data.pointsPerReferral}
          onPointsPerReferralChange={data.setPointsPerReferral}
          onSave={data.savePointsPerReferral}
        />
      )}

      <GiveawayUserModal open={showUserModal} onOpenChange={setShowUserModal} user={selectedUser} />
    </div>
  );
};

export default GiveawayBotManager;
