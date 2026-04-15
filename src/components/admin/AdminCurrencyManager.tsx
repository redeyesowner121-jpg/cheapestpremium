import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rate_to_inr: number;
  is_active: boolean;
  sort_order: number;
}

const AdminCurrencyManager: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Currency>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', flag: '🏳️', rate_to_inr: '' });

  useEffect(() => { loadCurrencies(); }, []);

  const loadCurrencies = async () => {
    const { data } = await supabase.from('currencies').select('*').order('sort_order', { ascending: true });
    if (data) setCurrencies(data);
  };

  const handleAdd = async () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.rate_to_inr) {
      toast.error('Code, Name & Rate are required');
      return;
    }
    const { error } = await supabase.from('currencies').insert({
      code: newCurrency.code.toUpperCase(),
      name: newCurrency.name,
      symbol: newCurrency.symbol || '$',
      flag: newCurrency.flag || '🏳️',
      rate_to_inr: parseFloat(newCurrency.rate_to_inr),
      sort_order: currencies.length
    });
    if (error) { toast.error('Failed to add currency'); return; }
    toast.success('Currency added!');
    setNewCurrency({ code: '', name: '', symbol: '', flag: '🏳️', rate_to_inr: '' });
    setShowAdd(false);
    loadCurrencies();
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from('currencies').update({
      ...editData,
      rate_to_inr: editData.rate_to_inr ? Number(editData.rate_to_inr) : undefined
    }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Updated!');
    setEditingId(null);
    loadCurrencies();
  };

  const handleDelete = async (id: string, code: string) => {
    if (code === 'INR') { toast.error('Cannot delete INR'); return; }
    await supabase.from('currencies').delete().eq('id', id);
    toast.success('Deleted!');
    loadCurrencies();
  };

  const handleToggle = async (id: string, val: boolean) => {
    await supabase.from('currencies').update({ is_active: val }).eq('id', id);
    loadCurrencies();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Currency Management
        </h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1" />Add
        </Button>
      </div>

      {showAdd && (
        <div className="bg-muted rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Code (USD)" value={newCurrency.code} onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value })} />
            <Input placeholder="Name" value={newCurrency.name} onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })} />
            <Input placeholder="Symbol ($)" value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })} />
            <Input placeholder="Flag emoji 🇺🇸" value={newCurrency.flag} onChange={e => setNewCurrency({ ...newCurrency, flag: e.target.value })} />
          </div>
          <Input type="number" placeholder="Rate to INR (e.g. 95)" value={newCurrency.rate_to_inr} onChange={e => setNewCurrency({ ...newCurrency, rate_to_inr: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1">Add Currency</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {currencies.map(c => (
          <div key={c.id} className="bg-card rounded-xl p-3 flex items-center gap-3 border border-border">
            <span className="text-xl">{c.flag}</span>
            {editingId === c.id ? (
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="Name" />
                  <Input type="number" value={editData.rate_to_inr || ''} onChange={e => setEditData({ ...editData, rate_to_inr: Number(e.target.value) })} placeholder="Rate" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(c.id)} className="p-1.5 bg-primary/10 rounded-lg"><Check className="w-4 h-4 text-primary" /></button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 bg-muted rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{c.code} - {c.name}</p>
                  <p className="text-xs text-muted-foreground">1 {c.code} = ₹{c.rate_to_inr}</p>
                </div>
                <Switch checked={c.is_active} onCheckedChange={v => handleToggle(c.id, v)} />
                <button onClick={() => { setEditingId(c.id); setEditData({ name: c.name, rate_to_inr: c.rate_to_inr }); }} className="p-1.5 hover:bg-muted rounded-lg">
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
                {c.code !== 'INR' && (
                  <button onClick={() => handleDelete(c.id, c.code)} className="p-1.5 hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminCurrencyManager;
