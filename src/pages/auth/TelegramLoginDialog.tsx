import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telegramCode: string;
  setTelegramCode: (v: string) => void;
  verifyingCode: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const TelegramLoginDialog: React.FC<Props> = ({
  open, onOpenChange, telegramCode, setTelegramCode, verifyingCode, onSubmit,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-[#0088cc]" />Telegram Login Code
        </DialogTitle>
        <DialogDescription>
          Open the Telegram bot and use /start to get your login code, then paste it below.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Login Code</label>
          <Input type="text" placeholder="Paste your 6-digit code here"
            value={telegramCode} onChange={(e) => setTelegramCode(e.target.value.trim())}
            className="h-12 text-center text-lg tracking-widest uppercase"
            maxLength={20} autoFocus disabled={verifyingCode} />
        </div>
        <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
          <p className="font-semibold mb-2">How to get your code:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Open Telegram and find <strong>@Air1_Premium_bot</strong></li>
            <li>Tap the /start command or send /login</li>
            <li>Copy the 6-digit code provided</li>
            <li>Paste it in the field above</li>
          </ol>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1"
            onClick={() => { onOpenChange(false); setTelegramCode(''); }} disabled={verifyingCode}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-[#0088cc] hover:bg-[#0077b3] text-white"
            disabled={verifyingCode || !telegramCode.trim()}>
            {verifyingCode ? 'Verifying...' : 'Login'}
          </Button>
        </div>
        <Button type="button" variant="ghost"
          className="w-full text-[#0088cc] hover:bg-transparent hover:text-[#0077b3]"
          onClick={() => window.open('https://t.me/Air1_Premium_bot', '_blank')}>
          <Send className="w-4 h-4 mr-2" />Open Telegram Bot
        </Button>
      </form>
    </DialogContent>
  </Dialog>
);

export default TelegramLoginDialog;
