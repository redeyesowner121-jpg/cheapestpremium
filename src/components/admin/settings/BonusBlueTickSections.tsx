import React from 'react';
import { Gift, Award, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SettingsSection, SettingItem, type SettingHandlers } from './SettingsPrimitives';

const PriceInput = ({ value, onUpdate, onSave, k }: any) => (
  <div className="flex items-center gap-1">
    <span className="text-sm text-muted-foreground">₹</span>
    <Input type="number" value={value}
      onChange={(e) => onUpdate(k, e.target.value)}
      onBlur={(e) => onSave(k, e.target.value)}
      className="w-24 h-9 text-sm rounded-lg" />
  </div>
);

export const BonusSettingsSection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Bonus Settings" icon={<Gift className="w-5 h-5" />}>
    <SettingItem label="Login Bonus" description="Amount given on first login">
      <PriceInput value={localSettings.login_bonus || '0'} onUpdate={updateLocal} onSave={handleSave} k="login_bonus" />
    </SettingItem>
    <SettingItem label="Daily Bonus Range" description="Random bonus amount range">
      <div className="flex items-center gap-2">
        <Input type="number" step="0.01" value={localSettings.daily_bonus_min || '0.10'}
          onChange={(e) => updateLocal('daily_bonus_min', e.target.value)}
          onBlur={(e) => handleSave('daily_bonus_min', e.target.value)}
          className="w-20 h-9 text-sm rounded-lg" placeholder="Min" />
        <span className="text-muted-foreground">to</span>
        <Input type="number" step="0.01" value={localSettings.daily_bonus_max || '1.00'}
          onChange={(e) => updateLocal('daily_bonus_max', e.target.value)}
          onBlur={(e) => handleSave('daily_bonus_max', e.target.value)}
          className="w-20 h-9 text-sm rounded-lg" placeholder="Max" />
      </div>
    </SettingItem>
    <SettingItem label="Referral Bonus" description="Amount given when referred user's first purchase">
      <PriceInput value={localSettings.referral_bonus || '10'} onUpdate={updateLocal} onSave={handleSave} k="referral_bonus" />
    </SettingItem>
    <SettingItem label="Min Referral Order Amount" description="Minimum product price to trigger referral bonus">
      <PriceInput value={localSettings.min_referral_amount || '15'} onUpdate={updateLocal} onSave={handleSave} k="min_referral_amount" />
    </SettingItem>
  </SettingsSection>
);

export const BlueTickSection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Blue Tick Settings" icon={<Award className="w-5 h-5" />}>
    <SettingItem label="Total Deposit Threshold" description="Amount needed for automatic blue tick">
      <PriceInput value={localSettings.blue_tick_threshold || '1000'} onUpdate={updateLocal} onSave={handleSave} k="blue_tick_threshold" />
    </SettingItem>
    <SettingItem label="Single Deposit Threshold" description="Single deposit amount for bonus">
      <PriceInput value={localSettings.single_deposit_bonus_threshold || '1000'} onUpdate={updateLocal} onSave={handleSave} k="single_deposit_bonus_threshold" />
    </SettingItem>
    <SettingItem label="Single Deposit Bonus" description="Bonus amount for single deposit threshold">
      <PriceInput value={localSettings.single_deposit_bonus_amount || '100'} onUpdate={updateLocal} onSave={handleSave} k="single_deposit_bonus_amount" />
    </SettingItem>
  </SettingsSection>
);

export const InventorySection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Inventory Settings" icon={<Package className="w-5 h-5" />}>
    <SettingItem label="Low Stock Threshold" description="Alert when stock falls below this">
      <Input type="number" value={localSettings.low_stock_threshold || '5'}
        onChange={(e) => updateLocal('low_stock_threshold', e.target.value)}
        onBlur={(e) => handleSave('low_stock_threshold', e.target.value)}
        className="w-24 h-9 text-sm rounded-lg" />
    </SettingItem>
  </SettingsSection>
);
