import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, Settings, Ticket, Gift } from 'lucide-react';
import AdminCouponManager from './AdminCouponManager';
import AdminRedeemCodeManager from './AdminRedeemCodeManager';

interface AdminSettingsTabProps {
  settings: Record<string, string>;
  onUpdateSetting: (key: string, value: string) => void;
}

const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ settings, onUpdateSetting }) => {
  const [showCoupons, setShowCoupons] = useState(false);
  const [showRedeemCodes, setShowRedeemCodes] = useState(false);

  return (
    <div className="space-y-4">
      {/* Coupon Section */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowCoupons(!showCoupons)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <Ticket className="w-5 h-5 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Coupon Management</h3>
              <p className="text-xs text-muted-foreground">Create flat, percentage & product-specific coupons</p>
            </div>
          </div>
          {showCoupons ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        {showCoupons && (
          <div className="p-4 border-t border-border">
            <AdminCouponManager />
          </div>
        )}
      </div>

      {/* Redeem Codes Section */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowRedeemCodes(!showRedeemCodes)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-xl">
              <Gift className="w-5 h-5 text-success" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Redeem Codes</h3>
              <p className="text-xs text-muted-foreground">Gift codes that add money to user wallet</p>
            </div>
          </div>
          {showRedeemCodes ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        {showRedeemCodes && (
          <div className="p-4 border-t border-border">
            <AdminRedeemCodeManager />
          </div>
        )}
      </div>

      {/* General Settings */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">App Settings</h3>
        </div>
        
        <div className="space-y-4">
          {/* App Info */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">App Information</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">App Name</span>
                <Input
                  value={settings.app_name || 'RKR Premium Store'}
                  onChange={(e) => onUpdateSetting('app_name', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Language</span>
                <Input
                  value={settings.app_language || 'English'}
                  onChange={(e) => onUpdateSetting('app_language', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Currency Symbol</span>
                <Input
                  value={settings.currency_symbol || '₹'}
                  onChange={(e) => onUpdateSetting('currency_symbol', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Contact */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">Contact Info</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">WhatsApp</span>
                <Input
                  value={settings.contact_whatsapp || '+918900684167'}
                  onChange={(e) => onUpdateSetting('contact_whatsapp', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <Input
                  value={settings.contact_email || ''}
                  onChange={(e) => onUpdateSetting('contact_email', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Payments */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">Payment Settings</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Min Deposit (Rs)</span>
                <Input
                  value={settings.min_deposit || '10'}
                  onChange={(e) => onUpdateSetting('min_deposit', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment QR Code URL</span>
                <Input
                  value={settings.payment_qr_code || ''}
                  onChange={(e) => onUpdateSetting('payment_qr_code', e.target.value)}
                  className="w-40 h-8 text-sm"
                  placeholder="QR code URL"
                />
              </div>
            </div>
          </div>
          
          {/* Bonuses */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">Bonus Settings</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Login Bonus (Rs)</span>
                <Input
                  value={settings.login_bonus || '0'}
                  onChange={(e) => onUpdateSetting('login_bonus', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Daily Bonus Min (Rs)</span>
                <Input
                  value={settings.daily_bonus_min || '0.10'}
                  onChange={(e) => onUpdateSetting('daily_bonus_min', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Daily Bonus Max (Rs)</span>
                <Input
                  value={settings.daily_bonus_max || '1.00'}
                  onChange={(e) => onUpdateSetting('daily_bonus_max', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Referral Bonus (Rs)</span>
                <Input
                  value={settings.referral_bonus || '10'}
                  onChange={(e) => onUpdateSetting('referral_bonus', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Blue Tick Settings */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">Blue Tick Settings</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Deposit Threshold (Rs)</span>
                <Input
                  value={settings.blue_tick_threshold || '1000'}
                  onChange={(e) => onUpdateSetting('blue_tick_threshold', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Single Deposit Threshold (Rs)</span>
                <Input
                  value={settings.single_deposit_bonus_threshold || '1000'}
                  onChange={(e) => onUpdateSetting('single_deposit_bonus_threshold', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Single Deposit Bonus (Rs)</span>
                <Input
                  value={settings.single_deposit_bonus_amount || '100'}
                  onChange={(e) => onUpdateSetting('single_deposit_bonus_amount', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Inventory */}
          <div className="border-b border-border pb-4">
            <h4 className="text-sm font-medium text-primary mb-2">Inventory Settings</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Low Stock Threshold</span>
                <Input
                  value={settings.low_stock_threshold || '5'}
                  onChange={(e) => onUpdateSetting('low_stock_threshold', e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Toggles */}
          <div>
            <h4 className="text-sm font-medium text-primary mb-2">Feature Toggles</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Maintenance Mode</span>
                <Switch
                  checked={settings.maintenance_mode === 'true'}
                  onCheckedChange={(v) => onUpdateSetting('maintenance_mode', v.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Allow Registration</span>
                <Switch
                  checked={settings.allow_registration !== 'false'}
                  onCheckedChange={(v) => onUpdateSetting('allow_registration', v.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Auto Approve Orders</span>
                <Switch
                  checked={settings.auto_approve_orders === 'true'}
                  onCheckedChange={(v) => onUpdateSetting('auto_approve_orders', v.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Notifications Enabled</span>
                <Switch
                  checked={settings.notification_enabled !== 'false'}
                  onCheckedChange={(v) => onUpdateSetting('notification_enabled', v.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Razorpay Enabled</span>
                <Switch
                  checked={settings.razorpay_enabled !== 'false'}
                  onCheckedChange={(v) => onUpdateSetting('razorpay_enabled', v.toString())}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Google Login</span>
                <Switch
                  checked={settings.google_login_enabled === 'true'}
                  onCheckedChange={(v) => onUpdateSetting('google_login_enabled', v.toString())}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsTab;
