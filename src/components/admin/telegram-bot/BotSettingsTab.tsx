import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SettingDef {
  key: string;
  label: string;
  emoji: string;
}

interface BotSettingsTabProps {
  settings: Record<string, string>;
  settingsCategory: string;
  setSettingsCategory: (v: string) => void;
  editingKey: string;
  editingValue: string;
  setEditingKey: (v: string) => void;
  setEditingValue: (v: string) => void;
  onSave: (key: string, value: string) => void;
  settingsDefs: Record<string, SettingDef[]>;
}

const BotSettingsTab: React.FC<BotSettingsTabProps> = ({
  settings, settingsCategory, setSettingsCategory, editingKey, editingValue,
  setEditingKey, setEditingValue, onSave, settingsDefs,
}) => (
  <div className="space-y-3">
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {Object.entries({ payment: '💳 Payment', bonus: '🎁 Bonus', store: '🏪 Store', bot: '🤖 Bot', security: '🔒 Security' }).map(([k, v]) => (
        <Button key={k} size="sm" variant={settingsCategory === k ? 'default' : 'outline'}
          className="rounded-xl text-xs whitespace-nowrap" onClick={() => setSettingsCategory(k)}>
          {v}
        </Button>
      ))}
    </div>
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      {(settingsDefs[settingsCategory] || []).map(s => (
        <div key={s.key} className="p-2.5 bg-muted/30 rounded-xl">
          {editingKey === s.key ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{s.emoji} {s.label}</p>
              <Input value={editingValue} onChange={e => setEditingValue(e.target.value)} className="rounded-xl" autoFocus />
              <div className="flex gap-2">
                <Button size="sm" className="rounded-xl" onClick={() => onSave(s.key, editingValue)}>Save</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingKey('')}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between cursor-pointer" onClick={() => { setEditingKey(s.key); setEditingValue(settings[s.key] || ''); }}>
              <div>
                <p className="text-sm font-medium">{s.emoji} {s.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{settings[s.key] || '—'}</p>
              </div>
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default BotSettingsTab;
