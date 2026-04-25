import React from 'react';
import { ToggleLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SettingsSection, SettingItem, type SettingHandlers } from './SettingsPrimitives';

const TOGGLES: { key: string; label: string; description: string; defaultOn?: boolean }[] = [
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Disable app for users during maintenance' },
  { key: 'allow_registration', label: 'Allow Registration', description: 'Allow new users to sign up', defaultOn: true },
  { key: 'auto_approve_orders', label: 'Auto Approve Orders', description: 'Automatically approve new orders' },
  { key: 'notification_enabled', label: 'Notifications', description: 'Enable push notifications', defaultOn: true },
  { key: 'razorpay_enabled', label: 'Razorpay Payments', description: 'Enable Razorpay payment gateway', defaultOn: true },
  { key: 'google_login_enabled', label: 'Google Login', description: 'Allow Google sign-in' },
  { key: 'telegram_premium_emoji', label: 'Telegram Premium Emoji', description: 'Use custom premium emoji in bot messages (requires Telegram Premium)' },
];

const FeatureTogglesSection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Feature Toggles" icon={<ToggleLeft className="w-5 h-5" />}>
    {TOGGLES.map(t => {
      const checked = t.defaultOn ? localSettings[t.key] !== 'false' : localSettings[t.key] === 'true';
      return (
        <SettingItem key={t.key} label={t.label} description={t.description}>
          <Switch checked={checked} onCheckedChange={(v) => {
            updateLocal(t.key, v.toString());
            handleSave(t.key, v.toString());
          }} />
        </SettingItem>
      );
    })}
  </SettingsSection>
);

export default FeatureTogglesSection;
