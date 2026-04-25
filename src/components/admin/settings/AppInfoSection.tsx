import React, { useRef, useState } from 'react';
import { Globe, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SettingsSection, SettingItem, type SettingHandlers } from './SettingsPrimitives';

interface Props extends SettingHandlers {
  onUpdateSetting: (key: string, value: string) => void;
  setLocalSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const AppInfoSection: React.FC<Props> = ({ localSettings, updateLocal, handleSave, onUpdateSetting, setLocalSettings }) => {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      onUpdateSetting('app_logo', publicUrl);
      setLocalSettings(prev => ({ ...prev, app_logo: publicUrl }));
      toast.success('Logo updated!');
    } catch (err) {
      console.error(err); toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  return (
    <SettingsSection title="App Information" icon={<Globe className="w-5 h-5" />} defaultOpen>
      <SettingItem label="App Name" description="Display name of your application">
        <Input value={localSettings.app_name || 'RKR Premium Store'}
          onChange={(e) => updateLocal('app_name', e.target.value)}
          onBlur={(e) => handleSave('app_name', e.target.value)}
          className="w-44 h-9 text-sm rounded-lg" />
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
          <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo} className="rounded-lg h-9">
            {uploadingLogo ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (<><Upload className="w-4 h-4 mr-1" /> Upload</>)}
          </Button>
        </div>
      </div>
      <SettingItem label="App Tagline" description="Tagline shown on splash screen">
        <Input value={localSettings.app_tagline || 'Premium Digital Products'}
          onChange={(e) => updateLocal('app_tagline', e.target.value)}
          onBlur={(e) => handleSave('app_tagline', e.target.value)}
          className="w-44 h-9 text-sm rounded-lg" />
      </SettingItem>
      <SettingItem label="App URL" description="Share link URL for products & referrals">
        <Input value={localSettings.app_url || 'https://cheapest-premiums.in'}
          onChange={(e) => updateLocal('app_url', e.target.value)}
          onBlur={(e) => handleSave('app_url', e.target.value)}
          className="w-44 h-9 text-sm rounded-lg" placeholder="https://yourdomain.com" />
      </SettingItem>
      <SettingItem label="Language" description="Default app language">
        <Input value={localSettings.app_language || 'English'}
          onChange={(e) => updateLocal('app_language', e.target.value)}
          onBlur={(e) => handleSave('app_language', e.target.value)}
          className="w-44 h-9 text-sm rounded-lg" />
      </SettingItem>
      <SettingItem label="Currency Symbol" description="Symbol used for prices">
        <Input value={localSettings.currency_symbol || '₹'}
          onChange={(e) => updateLocal('currency_symbol', e.target.value)}
          onBlur={(e) => handleSave('currency_symbol', e.target.value)}
          className="w-44 h-9 text-sm rounded-lg" />
      </SettingItem>
    </SettingsSection>
  );
};

export default AppInfoSection;
