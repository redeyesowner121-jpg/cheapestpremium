import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, ChevronRight, Settings, Globe, Phone, 
  CreditCard, Gift, Award, Package, ToggleLeft, Save, Check, Upload, Image
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import AdminRankManager from './AdminRankManager';
import AdminCurrencyManager from './AdminCurrencyManager';

interface AdminSettingsTabProps {
  settings: Record<string, string>;
  onUpdateSetting: (key: string, value: string) => void;
}

interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ 
  title, 
  icon, 
  children,
  defaultOpen = false 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            {icon}
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="p-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    <div className="shrink-0">
      {children}
    </div>
  </div>
);

const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ settings, onUpdateSetting }) => {
  const [localSettings, setLocalSettings] = useState<Record<string, string>>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const updateLocal = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = (key: string, value: string) => {
    onUpdateSetting(key, value);
    toast.success('Setting saved');
  };

  const handleSaveAll = () => {
    Object.entries(localSettings).forEach(([key, value]) => {
      if (settings[key] !== value) {
        onUpdateSetting(key, value);
      }
    });
    setHasChanges(false);
    toast.success('All settings saved');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      onUpdateSetting('app_logo', publicUrl);
      setLocalSettings(prev => ({ ...prev, app_logo: publicUrl }));
      toast.success('Logo updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Save All Button */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-xl p-3 flex items-center justify-between shadow-lg"
        >
          <p className="text-sm font-medium">You have unsaved changes</p>
          <Button size="sm" variant="secondary" onClick={handleSaveAll} className="rounded-lg">
            <Save className="w-4 h-4 mr-2" />
            Save All
          </Button>
        </motion.div>
      )}

      {/* App Information */}
      <SettingsSection title="App Information" icon={<Globe className="w-5 h-5" />} defaultOpen={true}>
        <SettingItem label="App Name" description="Display name of your application">
          <Input
            value={localSettings.app_name || 'RKR Premium Store'}
            onChange={(e) => updateLocal('app_name', e.target.value)}
            onBlur={(e) => handleSave('app_name', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
          />
        </SettingItem>
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">App Logo</p>
            <p className="text-xs text-muted-foreground">Logo for home & login pages</p>
          </div>
          <div className="flex items-center gap-2">
            {localSettings.app_logo && (
              <img src={localSettings.app_logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-border" />
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="rounded-lg h-9"
            >
              {uploadingLogo ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Upload</>
              )}
            </Button>
          </div>
        </div>
        <SettingItem label="App Tagline" description="Tagline shown on splash screen">
          <Input
            value={localSettings.app_tagline || 'Premium Digital Products'}
            onChange={(e) => updateLocal('app_tagline', e.target.value)}
            onBlur={(e) => handleSave('app_tagline', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
          />
        </SettingItem>
        <SettingItem label="App URL" description="Share link URL for products & referrals">
          <Input
            value={localSettings.app_url || 'https://cheapest-premiums.in'}
            onChange={(e) => updateLocal('app_url', e.target.value)}
            onBlur={(e) => handleSave('app_url', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="https://yourdomain.com"
          />
        </SettingItem>
        <SettingItem label="Language" description="Default app language">
          <Input
            value={localSettings.app_language || 'English'}
            onChange={(e) => updateLocal('app_language', e.target.value)}
            onBlur={(e) => handleSave('app_language', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
          />
        </SettingItem>
        <SettingItem label="Currency Symbol" description="Symbol used for prices">
          <Input
            value={localSettings.currency_symbol || '₹'}
            onChange={(e) => updateLocal('currency_symbol', e.target.value)}
            onBlur={(e) => handleSave('currency_symbol', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
          />
        </SettingItem>
      </SettingsSection>

      {/* Contact Info */}
      <SettingsSection title="Contact Info" icon={<Phone className="w-5 h-5" />}>
        <SettingItem label="WhatsApp Number" description="Customer support WhatsApp">
          <Input
            value={localSettings.contact_whatsapp || '+918900684167'}
            onChange={(e) => updateLocal('contact_whatsapp', e.target.value)}
            onBlur={(e) => handleSave('contact_whatsapp', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
          />
        </SettingItem>
        <SettingItem label="Email Address" description="Support email">
          <Input
            value={localSettings.contact_email || ''}
            onChange={(e) => updateLocal('contact_email', e.target.value)}
            onBlur={(e) => handleSave('contact_email', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="support@example.com"
          />
        </SettingItem>
      </SettingsSection>

      {/* Payment Settings */}
      <SettingsSection title="Payment Settings" icon={<CreditCard className="w-5 h-5" />}>
        <SettingItem label="Minimum Deposit" description="Minimum amount users can deposit">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.min_deposit || '10'}
              onChange={(e) => updateLocal('min_deposit', e.target.value)}
              onBlur={(e) => handleSave('min_deposit', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Payment QR Code" description="QR code image URL">
          <Input
            value={localSettings.payment_qr_code || ''}
            onChange={(e) => updateLocal('payment_qr_code', e.target.value)}
            onBlur={(e) => handleSave('payment_qr_code', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="https://..."
          />
        </SettingItem>
        <SettingItem label="Payment Link" description="Card payment redirect URL (e.g. Razorpay.me)">
          <Input
            value={localSettings.payment_link || 'https://razorpay.me/@asifikbalrubaiulislam'}
            onChange={(e) => updateLocal('payment_link', e.target.value)}
            onBlur={(e) => handleSave('payment_link', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="https://razorpay.me/..."
          />
        </SettingItem>
        <SettingItem label="Binance ID" description="Binance Pay ID for foreign users">
          <Input
            value={localSettings.binance_id || '1178303416'}
            onChange={(e) => updateLocal('binance_id', e.target.value)}
            onBlur={(e) => handleSave('binance_id', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="Binance ID"
          />
        </SettingItem>
        <SettingItem label="No Binance Message" description="Message for users without Binance">
          <Input
            value={localSettings.binance_contact_message || "You don't have Binance? Contact seller on WhatsApp for alternative payment."}
            onChange={(e) => updateLocal('binance_contact_message', e.target.value)}
            onBlur={(e) => handleSave('binance_contact_message', e.target.value)}
            className="w-44 h-9 text-sm rounded-lg"
            placeholder="Contact message..."
          />
        </SettingItem>
        <SettingItem label="USD Conversion Rate" description="1 USD = ? INR">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.usd_conversion_rate || '95'}
              onChange={(e) => updateLocal('usd_conversion_rate', e.target.value)}
              onBlur={(e) => handleSave('usd_conversion_rate', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Foreign Deposit Fee %" description="Extra fee for foreign deposits">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={localSettings.foreign_deposit_fee_percent || '10'}
              onChange={(e) => updateLocal('foreign_deposit_fee_percent', e.target.value)}
              onBlur={(e) => handleSave('foreign_deposit_fee_percent', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </SettingItem>
      </SettingsSection>

      {/* Bonus Settings */}
      <SettingsSection title="Bonus Settings" icon={<Gift className="w-5 h-5" />}>
        <SettingItem label="Login Bonus" description="Amount given on first login">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.login_bonus || '0'}
              onChange={(e) => updateLocal('login_bonus', e.target.value)}
              onBlur={(e) => handleSave('login_bonus', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Daily Bonus Range" description="Random bonus amount range">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              value={localSettings.daily_bonus_min || '0.10'}
              onChange={(e) => updateLocal('daily_bonus_min', e.target.value)}
              onBlur={(e) => handleSave('daily_bonus_min', e.target.value)}
              className="w-20 h-9 text-sm rounded-lg"
              placeholder="Min"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              step="0.01"
              value={localSettings.daily_bonus_max || '1.00'}
              onChange={(e) => updateLocal('daily_bonus_max', e.target.value)}
              onBlur={(e) => handleSave('daily_bonus_max', e.target.value)}
              className="w-20 h-9 text-sm rounded-lg"
              placeholder="Max"
            />
          </div>
        </SettingItem>
        <SettingItem label="Referral Bonus" description="Amount given when referred user's first purchase">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.referral_bonus || '10'}
              onChange={(e) => updateLocal('referral_bonus', e.target.value)}
              onBlur={(e) => handleSave('referral_bonus', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Min Referral Order Amount" description="Minimum product price to trigger referral bonus">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.min_referral_amount || '15'}
              onChange={(e) => updateLocal('min_referral_amount', e.target.value)}
              onBlur={(e) => handleSave('min_referral_amount', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
      </SettingsSection>

      {/* Blue Tick Settings */}
      <SettingsSection title="Blue Tick Settings" icon={<Award className="w-5 h-5" />}>
        <SettingItem label="Total Deposit Threshold" description="Amount needed for automatic blue tick">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.blue_tick_threshold || '1000'}
              onChange={(e) => updateLocal('blue_tick_threshold', e.target.value)}
              onBlur={(e) => handleSave('blue_tick_threshold', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Single Deposit Threshold" description="Single deposit amount for bonus">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.single_deposit_bonus_threshold || '1000'}
              onChange={(e) => updateLocal('single_deposit_bonus_threshold', e.target.value)}
              onBlur={(e) => handleSave('single_deposit_bonus_threshold', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
        <SettingItem label="Single Deposit Bonus" description="Bonus amount for single deposit threshold">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              value={localSettings.single_deposit_bonus_amount || '100'}
              onChange={(e) => updateLocal('single_deposit_bonus_amount', e.target.value)}
              onBlur={(e) => handleSave('single_deposit_bonus_amount', e.target.value)}
              className="w-24 h-9 text-sm rounded-lg"
            />
          </div>
        </SettingItem>
      </SettingsSection>

      {/* Inventory Settings */}
      <SettingsSection title="Inventory Settings" icon={<Package className="w-5 h-5" />}>
        <SettingItem label="Low Stock Threshold" description="Alert when stock falls below this">
          <Input
            type="number"
            value={localSettings.low_stock_threshold || '5'}
            onChange={(e) => updateLocal('low_stock_threshold', e.target.value)}
            onBlur={(e) => handleSave('low_stock_threshold', e.target.value)}
            className="w-24 h-9 text-sm rounded-lg"
          />
        </SettingItem>
      </SettingsSection>

      {/* Feature Toggles */}
      <SettingsSection title="Feature Toggles" icon={<ToggleLeft className="w-5 h-5" />}>
        <SettingItem label="Maintenance Mode" description="Disable app for users during maintenance">
          <Switch
            checked={localSettings.maintenance_mode === 'true'}
            onCheckedChange={(v) => {
              updateLocal('maintenance_mode', v.toString());
              handleSave('maintenance_mode', v.toString());
            }}
          />
        </SettingItem>
        <SettingItem label="Allow Registration" description="Allow new users to sign up">
          <Switch
            checked={localSettings.allow_registration !== 'false'}
            onCheckedChange={(v) => {
              updateLocal('allow_registration', v.toString());
              handleSave('allow_registration', v.toString());
            }}
          />
        </SettingItem>
        <SettingItem label="Auto Approve Orders" description="Automatically approve new orders">
          <Switch
            checked={localSettings.auto_approve_orders === 'true'}
            onCheckedChange={(v) => {
              updateLocal('auto_approve_orders', v.toString());
              handleSave('auto_approve_orders', v.toString());
            }}
          />
        </SettingItem>
        <SettingItem label="Notifications" description="Enable push notifications">
          <Switch
            checked={localSettings.notification_enabled !== 'false'}
            onCheckedChange={(v) => {
              updateLocal('notification_enabled', v.toString());
              handleSave('notification_enabled', v.toString());
            }}
          />
        </SettingItem>
        <SettingItem label="Razorpay Payments" description="Enable Razorpay payment gateway">
          <Switch
            checked={localSettings.razorpay_enabled !== 'false'}
            onCheckedChange={(v) => {
              updateLocal('razorpay_enabled', v.toString());
              handleSave('razorpay_enabled', v.toString());
            }}
          />
        </SettingItem>
        <SettingItem label="Google Login" description="Allow Google sign-in">
          <Switch
            checked={localSettings.google_login_enabled === 'true'}
            onCheckedChange={(v) => {
              updateLocal('google_login_enabled', v.toString());
              handleSave('google_login_enabled', v.toString());
            }}
          />
        </SettingItem>
      </SettingsSection>

      {/* Rank System */}
      <SettingsSection title="Rank System" icon={<Award className="w-5 h-5" />}>
        <AdminRankManager />
      </SettingsSection>

      {/* Currency Management */}
      <SettingsSection title="Currency Management" icon={<Globe className="w-5 h-5" />}>
        <AdminCurrencyManager />
      </SettingsSection>
    </div>
  );
};

export default AdminSettingsTab;