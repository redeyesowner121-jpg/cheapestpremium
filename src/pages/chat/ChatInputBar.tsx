import React, { useRef } from 'react';
import { Send, Image as ImageIcon, X, Reply, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './types';

interface Props {
  newMessage: string;
  setNewMessage: (v: string) => void;
  uploading: boolean;
  selectedImage: File | null;
  imagePreview: string | null;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: () => void;
  whatsappNumber: string;
  telegramClean: string;
  onWhatsApp: () => void;
  onTelegram: () => void;
}

const ChatInputBar: React.FC<Props> = ({
  newMessage, setNewMessage, uploading, selectedImage, imagePreview,
  onImageSelect, onRemoveImage, replyTo, onCancelReply, onSend,
  whatsappNumber, telegramClean, onWhatsApp, onTelegram,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-1">
        <div className="max-w-lg mx-auto">
          <div className="bg-muted/50 rounded-xl px-3 py-1.5 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            {whatsappNumber && (
              <button onClick={onWhatsApp} className="flex items-center gap-1 hover:text-[#25D366] transition-colors">
                <MessageCircle className="w-3 h-3" /><span>WhatsApp</span>
              </button>
            )}
            {whatsappNumber && telegramClean && <span className="text-border">•</span>}
            {telegramClean && (
              <button onClick={onTelegram} className="flex items-center gap-1 hover:text-[#0088cc] transition-colors">
                <Send className="w-3 h-3" /><span>Telegram</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {replyTo && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-10">
          <div className="max-w-lg mx-auto bg-card border border-border rounded-t-xl px-3 py-2 flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
              <p className="text-[11px] font-semibold text-primary">{replyTo.is_admin ? 'Admin' : 'You'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📷 Photo'}</p>
            </div>
            <button onClick={onCancelReply} className="p-1 hover:bg-muted rounded-full">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className={`fixed ${replyTo ? 'bottom-28' : 'bottom-20'} left-4 right-4 max-w-lg mx-auto z-10`}>
          <div className="bg-card rounded-xl p-2 shadow-card relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
            <button onClick={onRemoveImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-border px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageSelect} className="hidden" />
          <button className="p-2 rounded-full hover:bg-muted transition-colors" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </button>
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSend()}
            className="flex-1 h-10 rounded-full bg-muted border-0"
          />
          <Button size="icon" className="w-10 h-10 rounded-full" onClick={onSend}
            disabled={(!newMessage.trim() && !selectedImage) || uploading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </>
  );
};

export default ChatInputBar;
