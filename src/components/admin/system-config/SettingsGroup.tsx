import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';

export interface SettingField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'url' | 'color';
  hint?: string;
  placeholder?: string;
}

interface Props {
  title: string;
  description?: string;
  fields: SettingField[];
}

const SettingsGroup: React.FC<Props> = ({ title, description, fields }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const keys = fields.map(f => f.key);
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', keys);
      const map: Record<string, string> = {};
      keys.forEach(k => { map[k] = ''; });
      (data || []).forEach((r: any) => { map[r.key] = r.value || ''; });
      setValues(map);
      setLoading(false);
    })();
  }, [JSON.stringify(fields.map(f => f.key))]);

  const onSave = async () => {
    setSaving(true);
    try {
      for (const field of fields) {
        const val = values[field.key] ?? '';
        // Upsert: try update first, insert if missing
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', field.key)
          .maybeSingle();
        if (existing) {
          await supabase.from('app_settings').update({ value: val }).eq('key', field.key);
        } else {
          await supabase.from('app_settings').insert({ key: field.key, value: val });
        }
      }
      toast.success(`${title} saved`);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(field => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type={field.type || 'text'}
              value={values[field.key] || ''}
              placeholder={field.placeholder}
              onChange={(e) => setValues(v => ({ ...v, [field.key]: e.target.value }))}
            />
            {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </Card>
  );
};

export default SettingsGroup;
