import React from 'react';
import { Link, Key, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import StockItemsSection from './StockItemsSection';

interface Props {
  productForm: any;
  setProductForm: (form: any) => void;
  deliveryType: 'link' | 'credentials';
  setDeliveryType: (t: 'link' | 'credentials') => void;
  deliveryMode: 'repeated' | 'unique';
  onDeliveryModeChange: (m: 'repeated' | 'unique') => void;
  credUsername: string;
  setCredUsername: (v: string) => void;
  credPassword: string;
  setCredPassword: (v: string) => void;
  updateAccessLink: (type: 'link' | 'credentials', link?: string, user?: string, pass?: string) => void;
  // stock
  editingProduct: any;
  stockItems: any[];
  loadingStock: boolean;
  newStockLink: string;
  setNewStockLink: (v: string) => void;
  onAddStock: () => void;
  onDeleteStock: (id: string) => void;
}

const DeliveryConfigSection: React.FC<Props> = (p) => {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Auto-Delivery Type</label>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Button type="button" variant={p.deliveryType === 'link' ? 'default' : 'outline'} size="sm"
          onClick={() => p.setDeliveryType('link')} className="gap-1.5">
          <Link className="w-3.5 h-3.5" /> Direct Link
        </Button>
        <Button type="button" variant={p.deliveryType === 'credentials' ? 'default' : 'outline'} size="sm"
          onClick={() => { p.setDeliveryType('credentials'); p.updateAccessLink('credentials'); }} className="gap-1.5">
          <Key className="w-3.5 h-3.5" /> ID / Password
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <div>
            <label className="text-xs font-medium block">Unique Code Per Order</label>
            <p className="text-[10px] text-muted-foreground">Each order gets a unique code from stock</p>
          </div>
        </div>
        <Switch checked={p.deliveryMode === 'unique'}
          onCheckedChange={(checked) => p.onDeliveryModeChange(checked ? 'unique' : 'repeated')} />
      </div>

      {p.deliveryMode === 'repeated' ? (
        <>
          {p.deliveryType === 'link' ? (
            <>
              <Textarea
                placeholder="Access Link (https://...) — supports long URLs"
                value={p.productForm.access_link}
                onChange={(e) => p.setProductForm({ ...p.productForm, access_link: e.target.value })}
                className="text-xs h-9 min-h-[36px] max-h-[36px] py-2 font-mono resize-none whitespace-nowrap overflow-x-auto"
                rows={1}
              />
              {p.productForm.access_link?.trim() && (
                <div className="space-y-2 mt-2 p-3 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground">Link Visibility</p>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1.5">🤖 Show in Bot</label>
                    <Switch checked={p.productForm.show_link_in_bot !== false}
                      onCheckedChange={(v) => p.setProductForm({ ...p.productForm, show_link_in_bot: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1.5">🌐 Show in Website</label>
                    <Switch checked={p.productForm.show_link_in_website !== false}
                      onCheckedChange={(v) => p.setProductForm({ ...p.productForm, show_link_in_website: v })} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Username / Email / ID</label>
                <Input placeholder="user@example.com" value={p.credUsername}
                  onChange={(e) => { p.setCredUsername(e.target.value); p.updateAccessLink('credentials', undefined, e.target.value, p.credPassword); }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Password</label>
                <Input placeholder="••••••••" value={p.credPassword}
                  onChange={(e) => { p.setCredPassword(e.target.value); p.updateAccessLink('credentials', undefined, p.credUsername, e.target.value); }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <StockItemsSection
          editingProduct={p.editingProduct}
          deliveryType={p.deliveryType}
          stockItems={p.stockItems}
          loadingStock={p.loadingStock}
          newStockLink={p.newStockLink}
          setNewStockLink={p.setNewStockLink}
          onAdd={p.onAddStock}
          onDelete={p.onDeleteStock}
        />
      )}
    </div>
  );
};

export default DeliveryConfigSection;
