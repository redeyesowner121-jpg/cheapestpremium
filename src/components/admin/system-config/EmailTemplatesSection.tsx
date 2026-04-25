import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface Template {
  id: string;
  template_key: string;
  display_name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: any;
  is_active: boolean;
  description: string | null;
}

const EmailTemplatesSection: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_templates').select('*').order('display_name');
    setTemplates(data || []);
    if (!selectedKey && data?.length) {
      setSelectedKey(data[0].template_key);
      setEditing(data[0] as Template);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedKey) {
      const t = templates.find(x => x.template_key === selectedKey);
      if (t) setEditing({ ...t });
    }
  }, [selectedKey]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from('email_templates').update({
      subject: editing.subject,
      html_body: editing.html_body,
      text_body: editing.text_body,
      is_active: editing.is_active,
      description: editing.description,
    }).eq('id', editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Template saved');
    load();
  };

  if (loading) {
    return <Card className="p-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></Card>;
  }

  const vars: string[] = Array.isArray(editing?.variables) ? editing!.variables : [];

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold">Email Templates</h3>
        <p className="text-sm text-muted-foreground mt-1">Edit subject and body of automated emails. Use {`{{variable}}`} placeholders.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Template</Label>
        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map(t => (
              <SelectItem key={t.template_key} value={t.template_key}>{t.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editing && (
        <>
          {editing.description && (
            <p className="text-xs text-muted-foreground italic">{editing.description}</p>
          )}

          {vars.length > 0 && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="font-semibold">Available variables:</span>{' '}
              {vars.map(v => <code key={v} className="mx-1 px-1 bg-background rounded">{`{{${v}}}`}</code>)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>HTML Body</Label>
            <Textarea
              value={editing.html_body}
              rows={10}
              className="font-mono text-xs"
              onChange={e => setEditing({ ...editing, html_body: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Plain Text Body (optional)</Label>
            <Textarea
              value={editing.text_body || ''}
              rows={4}
              className="font-mono text-xs"
              onChange={e => setEditing({ ...editing, text_body: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={editing.is_active}
                onCheckedChange={v => setEditing({ ...editing, is_active: v })}
              />
              <Label>Active</Label>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Template
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default EmailTemplatesSection;
