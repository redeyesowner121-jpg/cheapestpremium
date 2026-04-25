import React from 'react';
import { Phone, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SettingsSection, SettingItem, type SettingHandlers } from './SettingsPrimitives';

const NumberInput = ({ value, onChange, onBlur, prefix, suffix, className = 'w-24', ...rest }: any) => (
  <div className="flex items-center gap-1">
    {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
    <Input type="number" value={value} onChange={onChange} onBlur={onBlur}
      className={`${className} h-9 text-sm rounded-lg`} {...rest} />
    {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
  </div>
);

export const ContactInfoSection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Contact Info" icon={<Phone className="w-5 h-5" />}>
    <SettingItem label="WhatsApp Number" description="Customer support WhatsApp">
      <Input value={localSettings.contact_whatsapp || '+918900684167'}
        onChange={(e) => updateLocal('contact_whatsapp', e.target.value)}
        onBlur={(e) => handleSave('contact_whatsapp', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" />
    </SettingItem>
    <SettingItem label="Email Address" description="Support email">
      <Input value={localSettings.contact_email || ''}
        onChange={(e) => updateLocal('contact_email', e.target.value)}
        onBlur={(e) => handleSave('contact_email', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" placeholder="support@example.com" />
    </SettingItem>
  </SettingsSection>
);

export const PaymentSettingsSection: React.FC<SettingHandlers> = ({ localSettings, updateLocal, handleSave }) => (
  <SettingsSection title="Payment Settings" icon={<CreditCard className="w-5 h-5" />}>
    <SettingItem label="Minimum Deposit" description="Minimum amount users can deposit">
      <NumberInput prefix="₹" value={localSettings.min_deposit || '10'}
        onChange={(e: any) => updateLocal('min_deposit', e.target.value)}
        onBlur={(e: any) => handleSave('min_deposit', e.target.value)} />
    </SettingItem>
    <SettingItem label="Payment QR Code" description="QR code image URL">
      <Input value={localSettings.payment_qr_code || ''}
        onChange={(e) => updateLocal('payment_qr_code', e.target.value)}
        onBlur={(e) => handleSave('payment_qr_code', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" placeholder="https://..." />
    </SettingItem>
    <SettingItem label="Payment Link" description="Card payment redirect URL (e.g. Razorpay.me)">
      <Input value={localSettings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam'}
        onChange={(e) => updateLocal('payment_link', e.target.value)}
        onBlur={(e) => handleSave('payment_link', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" placeholder="https://razorpay.me/..." />
    </SettingItem>
    <SettingItem label="Binance ID" description="Binance Pay ID for foreign users">
      <Input value={localSettings.binance_id || '1178303416'}
        onChange={(e) => updateLocal('binance_id', e.target.value)}
        onBlur={(e) => handleSave('binance_id', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" placeholder="Binance ID" />
    </SettingItem>
    <SettingItem label="No Binance Message" description="Message for users without Binance">
      <Input value={localSettings.binance_contact_message || "You don't have Binance? Contact seller on WhatsApp for alternative payment."}
        onChange={(e) => updateLocal('binance_contact_message', e.target.value)}
        onBlur={(e) => handleSave('binance_contact_message', e.target.value)}
        className="w-44 h-9 text-sm rounded-lg" placeholder="Contact message..." />
    </SettingItem>
    <SettingItem label="USD Conversion Rate" description="1 USD = ? INR">
      <NumberInput prefix="₹" value={localSettings.usd_conversion_rate || '95'}
        onChange={(e: any) => updateLocal('usd_conversion_rate', e.target.value)}
        onBlur={(e: any) => handleSave('usd_conversion_rate', e.target.value)} />
    </SettingItem>
    <SettingItem label="Foreign Deposit Fee %" description="Extra fee for foreign deposits">
      <NumberInput suffix="%" value={localSettings.foreign_deposit_fee_percent || '10'}
        onChange={(e: any) => updateLocal('foreign_deposit_fee_percent', e.target.value)}
        onBlur={(e: any) => handleSave('foreign_deposit_fee_percent', e.target.value)} />
    </SettingItem>
  </SettingsSection>
);
