import React from 'react';
import { Link, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  deliveryType: 'link' | 'credentials';
  setDeliveryType: (t: 'link' | 'credentials') => void;
  accessLink: string;
  setAccessLink: (v: string) => void;
  credUsername: string;
  setCredUsername: (v: string) => void;
  credPassword: string;
  setCredPassword: (v: string) => void;
}

export const DeliveryEditor: React.FC<Props> = ({
  deliveryType, setDeliveryType,
  accessLink, setAccessLink,
  credUsername, setCredUsername,
  credPassword, setCredPassword,
}) => (
  <>
    <div>
      <label className="text-sm font-medium mb-2 block">Delivery Type</label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={deliveryType === 'link' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDeliveryType('link')}
          className="gap-1.5"
        >
          <Link className="w-3.5 h-3.5" />
          Direct Link
        </Button>
        <Button
          type="button"
          variant={deliveryType === 'credentials' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDeliveryType('credentials')}
          className="gap-1.5"
        >
          <Key className="w-3.5 h-3.5" />
          ID / Password
        </Button>
      </div>
    </div>

    {deliveryType === 'link' ? (
      <Input
        placeholder="Access Link (https://...)"
        value={accessLink}
        onChange={(e) => setAccessLink(e.target.value)}
      />
    ) : (
      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Username / Email / ID</label>
          <Input placeholder="user@example.com" value={credUsername} onChange={(e) => setCredUsername(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block text-muted-foreground">Password</label>
          <Input placeholder="••••••••" value={credPassword} onChange={(e) => setCredPassword(e.target.value)} />
        </div>
      </div>
    )}
  </>
);
