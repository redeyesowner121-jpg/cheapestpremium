import React from 'react';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';

interface Props {
  whatsappNumber: string;
  telegramClean: string;
  onBack: () => void;
  onWhatsApp: () => void;
  onTelegram: () => void;
}

const ChatHeader: React.FC<Props> = ({ whatsappNumber, telegramClean, onBack, onWhatsApp, onTelegram }) => (
  <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
    <div className="max-w-lg mx-auto flex items-center gap-3">
      <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </button>
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">A</span>
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">Admin Support</h2>
          <p className="text-[11px] text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-success rounded-full inline-block" />
            Online
          </p>
        </div>
      </div>
      {whatsappNumber && (
        <button className="p-2.5 bg-[#25D366]/10 rounded-xl hover:bg-[#25D366]/20 transition-colors" onClick={onWhatsApp} title="WhatsApp">
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
        </button>
      )}
      {telegramClean && (
        <button className="p-2.5 bg-[#0088cc]/10 rounded-xl hover:bg-[#0088cc]/20 transition-colors" onClick={onTelegram} title="Telegram">
          <Send className="w-5 h-5 text-[#0088cc]" />
        </button>
      )}
    </div>
  </header>
);

export default ChatHeader;
