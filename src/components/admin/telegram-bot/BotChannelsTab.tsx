import React from 'react';
import { Radio, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BotChannelsTabProps {
  channels: string[];
  newChannel: string;
  setNewChannel: (v: string) => void;
  onAdd: () => void;
  onRemove: (ch: string) => void;
}

const BotChannelsTab: React.FC<BotChannelsTabProps> = ({ channels, newChannel, setNewChannel, onAdd, onRemove }) => (
  <div className="space-y-3">
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Required Channels ({channels.length})</h4>
      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No channels — users can use bot freely</p>
      ) : channels.map((ch, i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
          <span className="text-sm font-medium">{ch}</span>
          <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => onRemove(ch)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input placeholder="@channel_name" value={newChannel} onChange={e => setNewChannel(e.target.value)} className="rounded-xl" />
        <Button className="rounded-xl" onClick={onAdd}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  </div>
);

export default BotChannelsTab;
