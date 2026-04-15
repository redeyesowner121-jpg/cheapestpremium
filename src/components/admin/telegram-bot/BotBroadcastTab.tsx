import React from 'react';
import { Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface BotBroadcastTabProps {
  broadcastMsg: string;
  setBroadcastMsg: (v: string) => void;
  broadcasting: boolean;
  onBroadcast: () => void;
}

const BotBroadcastTab: React.FC<BotBroadcastTabProps> = ({ broadcastMsg, setBroadcastMsg, broadcasting, onBroadcast }) => (
  <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
    <h4 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Broadcast Message</h4>
    <p className="text-xs text-muted-foreground">বটের মাধ্যমে সব ইউজারকে মেসেজ পাঠাতে /broadcast কমান্ড ব্যবহার করুন।</p>
    <Textarea placeholder="Type your broadcast message..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={4} className="rounded-xl" />
    <Button className="w-full rounded-xl" onClick={onBroadcast} disabled={broadcasting}>
      <Send className="w-4 h-4 mr-2" /> {broadcasting ? 'Sending...' : 'Preview Broadcast'}
    </Button>
  </div>
);

export default BotBroadcastTab;
