import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface CartMessage {
  id: string;
  message: string;
  is_active: boolean;
  sort_order: number;
}

const AdminCartMessagesManager: React.FC = () => {
  const [messages, setMessages] = useState<CartMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const loadMessages = async () => {
    const { data } = await supabase
      .from('empty_cart_messages')
      .select('*')
      .order('sort_order', { ascending: true });
    setMessages((data as CartMessage[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, []);

  const handleAdd = async () => {
    if (!newMessage.trim()) return;
    const maxOrder = messages.length > 0 ? Math.max(...messages.map(m => m.sort_order)) : 0;
    const { error } = await supabase.from('empty_cart_messages').insert({
      message: newMessage.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) { toast.error('Failed to add'); return; }
    toast.success('Message added!');
    setNewMessage('');
    loadMessages();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('empty_cart_messages').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    loadMessages();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from('empty_cart_messages').update({ is_active: !current }).eq('id', id);
    loadMessages();
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from('empty_cart_messages').update({ message: editText.trim() }).eq('id', id);
    setEditingId(null);
    toast.success('Updated');
    loadMessages();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Cart Messages ({messages.length})</h3>
        <span className="text-xs text-muted-foreground">{messages.filter(m => m.is_active).length} active</span>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          placeholder="New funny message... 😜"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="rounded-xl"
        />
        <Button onClick={handleAdd} size="sm" className="rounded-xl shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {/* Messages list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
              msg.is_active ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-60'
            }`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

            {editingId === msg.id ? (
              <div className="flex-1 flex gap-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(msg.id)}
                  className="rounded-lg text-sm"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(msg.id)} className="shrink-0 h-9 w-9">
                  <Check className="w-4 h-4 text-green-500" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="shrink-0 h-9 w-9">
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <>
                <p className="flex-1 text-sm text-foreground truncate">{msg.message}</p>
                <Switch
                  checked={msg.is_active ?? true}
                  onCheckedChange={() => handleToggle(msg.id, msg.is_active ?? true)}
                />
                <Button
                  size="icon" variant="ghost"
                  onClick={() => { setEditingId(msg.id); setEditText(msg.message); }}
                  className="h-8 w-8 shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => handleDelete(msg.id)}
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <p className="text-center py-4 text-muted-foreground text-sm">No messages yet. Add some funny messages!</p>
      )}
    </div>
  );
};

export default AdminCartMessagesManager;
