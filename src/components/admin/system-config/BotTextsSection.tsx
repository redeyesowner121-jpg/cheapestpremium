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
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';

interface BotText {
  id: string;
  text_key: string;
  language: string;
  content: string;
  category: string;
  description: string | null;
  is_active: boolean;
}

const BotTextsSection: React.FC = () => {
  const [items, setItems] = useState<BotText[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterLang, setFilterLang] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<Partial<BotText>>({
    text_key: '', language: 'en', content: '', category: 'general', is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('bot_texts').select('*').order('category').order('text_key');
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (item: BotText) => {
    const { error } = await supabase.from('bot_texts').update({
      content: item.content,
      description: item.description,
      is_active: item.is_active,
    }).eq('id', item.id);
    if (error) return toast.error(error.message);
    toast.success('Saved');
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this text entry?')) return;
    const { error } = await supabase.from('bot_texts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Deleted');
    load();
  };

  const create = async () => {
    if (!newItem.text_key || !newItem.content) {
      return toast.error('Key and content required');
    }
    const { error } = await supabase.from('bot_texts').insert({
      text_key: newItem.text_key!,
      language: newItem.language || 'en',
      content: newItem.content!,
      category: newItem.category || 'general',
      is_active: newItem.is_active ?? true,
    });
    if (error) return toast.error(error.message);
    toast.success('Created');
    setAdding(false);
    setNewItem({ text_key: '', language: 'en', content: '', category: 'general', is_active: true });
    load();
  };

  if (loading) {
    return <Card className="p-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></Card>;
  }

  const categories = Array.from(new Set(items.map(i => i.category)));
  const languages = Array.from(new Set(items.map(i => i.language)));
  const filtered = items.filter(i =>
    (filterCat === 'all' || i.category === filterCat) &&
    (filterLang === 'all' || i.language === filterLang)
  );

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">Telegram Bot Texts</h3>
          <p className="text-sm text-muted-foreground mt-1">Edit bot welcome messages, button labels, and prompts.</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Language" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {adding && (
        <Card className="p-4 border-primary/40 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Key</Label>
              <Input value={newItem.text_key} onChange={e => setNewItem({ ...newItem, text_key: e.target.value })} placeholder="e.g. btn_help" />
            </div>
            <div>
              <Label>Language</Label>
              <Input value={newItem.language} onChange={e => setNewItem({ ...newItem, language: e.target.value })} placeholder="en" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="general" />
            </div>
          </div>
          <div>
            <Label>Content</Label>
            <Textarea value={newItem.content} onChange={e => setNewItem({ ...newItem, content: e.target.value })} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map(item => (
          <Card key={item.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{item.text_key}</code>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{item.language}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary/30">{item.category}</span>
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.is_active}
                  onCheckedChange={v => {
                    const updated = { ...item, is_active: v };
                    setItems(items.map(x => x.id === item.id ? updated : x));
                    save(updated);
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            <Textarea
              value={item.content}
              rows={2}
              onChange={e => setItems(items.map(x => x.id === item.id ? { ...x, content: e.target.value } : x))}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => save(item)}>
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No texts found</p>}
      </div>
    </Card>
  );
};

export default BotTextsSection;
