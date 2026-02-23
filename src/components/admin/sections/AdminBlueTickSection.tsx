import React, { useState } from 'react';
import { Search, CreditCard, Gift, Award, Check, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BlueTick from '@/components/BlueTick';

interface AdminBlueTickSectionProps {
  users: any[];
  settings: any;
  onDataChange: () => void;
}

const AdminBlueTickSection: React.FC<AdminBlueTickSectionProps> = ({
  users,
  settings,
  onDataChange,
}) => {
  const [blueTickSearch, setBlueTickSearch] = useState('');
  const [blueTickPrice, setBlueTickPrice] = useState('');
  const [savingBTPrice, setSavingBTPrice] = useState(false);

  return (
    <div className="space-y-4">
      {/* Set Blue Tick Price */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Blue Tick Purchase Price
        </h4>
        <p className="text-xs text-muted-foreground">
          ইউজাররা এই প্রাইসে ওয়ালেট থেকে Blue Tick কিনতে পারবে। 0 দিলে purchase অপশন বন্ধ হবে।
        </p>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 flex-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <Input
              type="number"
              placeholder={settings?.blue_tick_price || '0'}
              value={blueTickPrice}
              onChange={(e) => setBlueTickPrice(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            disabled={savingBTPrice || !blueTickPrice}
            className="rounded-xl"
            onClick={async () => {
              setSavingBTPrice(true);
              await supabase.from('app_settings').upsert(
                { key: 'blue_tick_price', value: blueTickPrice, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
              );
              toast.success(`Blue Tick price set to ₹${blueTickPrice}`);
              setBlueTickPrice('');
              setSavingBTPrice(false);
              onDataChange();
            }}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Current price: <span className="font-semibold text-foreground">₹{settings?.blue_tick_price || '0 (disabled)'}</span>
        </p>
      </div>

      {/* Search & Gift Blue Tick */}
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Gift className="w-4 h-4 text-accent" />
          Gift Blue Tick to User
        </h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search user to gift blue tick..."
            value={blueTickSearch}
            onChange={(e) => setBlueTickSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {users
            .filter(u =>
              blueTickSearch && (
                u.name?.toLowerCase().includes(blueTickSearch.toLowerCase()) ||
                u.email?.toLowerCase().includes(blueTickSearch.toLowerCase())
              )
            )
            .slice(0, 10)
            .map((user: any) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white">
                  {(user.name || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-foreground text-sm truncate">{user.name}</p>
                    {user.has_blue_check && <BlueTick size="sm" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                {user.has_blue_check ? (
                  <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-full font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white"
                    onClick={async () => {
                      await supabase.from('profiles').update({ has_blue_check: true }).eq('id', user.id);
                      await supabase.from('notifications').insert({
                        user_id: user.id,
                        title: 'Blue Tick Received! ✅',
                        message: 'Congratulations! You have been gifted a verified Blue Tick badge!',
                        type: 'reward'
                      });
                      toast.success(`Blue Tick gifted to ${user.name}!`);
                      onDataChange();
                    }}
                  >
                    <Award className="w-3.5 h-3.5 mr-1" />
                    Gift
                  </Button>
                )}
              </div>
            ))}
          {blueTickSearch && users.filter(u =>
            u.name?.toLowerCase().includes(blueTickSearch.toLowerCase()) ||
            u.email?.toLowerCase().includes(blueTickSearch.toLowerCase())
          ).length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">No users found</p>
          )}
          {!blueTickSearch && (
            <p className="text-center text-muted-foreground py-4 text-sm">Search for a user above</p>
          )}
        </div>
      </div>

      {/* Blue Tick Users List */}
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <BlueTick size="sm" />
          Verified Users ({users.filter(u => u.has_blue_check).length})
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {users.filter(u => u.has_blue_check).map((user: any) => (
            <div key={user.id} className="flex items-center gap-3 p-3 bg-sky-50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
                {(user.name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                  {user.name} <BlueTick size="sm" />
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive h-7 text-xs"
                onClick={async () => {
                  if (!confirm(`Remove Blue Tick from ${user.name}?`)) return;
                  await supabase.from('profiles').update({ has_blue_check: false }).eq('id', user.id);
                  toast.success(`Blue Tick removed from ${user.name}`);
                  onDataChange();
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          {users.filter(u => u.has_blue_check).length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">No verified users yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBlueTickSection;
