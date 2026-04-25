import React from 'react';
import SettingsGroup, { SettingField } from './SettingsGroup';

const brandingFields: SettingField[] = [
  { key: 'app_name', label: 'App Name', placeholder: 'Cheapest Premiums' },
  { key: 'app_tagline', label: 'Tagline', placeholder: 'Premium Subscriptions • Instant Delivery' },
  { key: 'app_url', label: 'App URL', type: 'url', placeholder: 'https://cheapest-premiums.in' },
  { key: 'app_logo_url', label: 'Logo URL', type: 'url' },
  { key: 'brand_primary_color', label: 'Primary Color', type: 'color' },
  { key: 'brand_dark_color', label: 'Dark/Header Color', type: 'color' },
];

const contactFields: SettingField[] = [
  { key: 'support_email', label: 'Support Email', type: 'email' },
  { key: 'admin_alert_email', label: 'Admin Alert Email', type: 'email', hint: 'Receives system failure alerts' },
  { key: 'support_telegram', label: 'Support Telegram', placeholder: '@RKRxSupport' },
  { key: 'proofs_channel', label: 'Proofs Channel', placeholder: '@RKRxProofs' },
  { key: 'email_from_name', label: 'Email From Name' },
  { key: 'email_from_address', label: 'Email From Address', type: 'email' },
];

const BrandingSection: React.FC = () => (
  <div className="space-y-6">
    <SettingsGroup
      title="Branding"
      description="App identity shown in emails, bot, and UI"
      fields={brandingFields}
    />
    <SettingsGroup
      title="Contact & Email"
      description="Support contacts and outgoing email identity"
      fields={contactFields}
    />
  </div>
);

export default BrandingSection;
