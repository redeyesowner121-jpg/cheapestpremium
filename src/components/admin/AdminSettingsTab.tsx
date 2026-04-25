import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Award, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AdminRankManager from './AdminRankManager';
import AdminCurrencyManager from './AdminCurrencyManager';
import { SettingsSection } from './settings/SettingsPrimitives';
import AppInfoSection from './settings/AppInfoSection';
import { ContactInfoSection, PaymentSettingsSection } from './settings/ContactPaymentSections';
import { BonusSettingsSection, BlueTickSection, InventorySection } from './settings/BonusBlueTickSections';
import FeatureTogglesSection from './settings/FeatureTogglesSection';

interface AdminSettingsTabProps {
  settings: Record<string, string>;
  onUpdateSetting: (key: string, value: string) => void;
}

const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ settings, onUpdateSetting }) => {
  const [localSettings, setLocalSettings] = useState<Record<string, string>>(settings);
  const [hasChanges, setHasChanges] = useState(false);

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
      if (settings[key] !== value) onUpdateSetting(key, value);
    });
    setHasChanges(false);
    toast.success('All settings saved');
  };

  const handlers = { localSettings, updateLocal, handleSave };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-xl p-3 flex items-center justify-between shadow-lg"
        >
          <p className="text-sm font-medium">You have unsaved changes</p>
          <Button size="sm" variant="secondary" onClick={handleSaveAll} className="rounded-lg">
            <Save className="w-4 h-4 mr-2" />Save All
          </Button>
        </motion.div>
      )}

      <AppInfoSection {...handlers} onUpdateSetting={onUpdateSetting} setLocalSettings={setLocalSettings} />
      <ContactInfoSection {...handlers} />
      <PaymentSettingsSection {...handlers} />
      <BonusSettingsSection {...handlers} />
      <BlueTickSection {...handlers} />
      <InventorySection {...handlers} />
      <FeatureTogglesSection {...handlers} />

      <SettingsSection title="Rank System" icon={<Award className="w-5 h-5" />}>
        <AdminRankManager />
      </SettingsSection>
      <SettingsSection title="Currency Management" icon={<Globe className="w-5 h-5" />}>
        <AdminCurrencyManager />
      </SettingsSection>
    </div>
  );
};

export default AdminSettingsTab;
