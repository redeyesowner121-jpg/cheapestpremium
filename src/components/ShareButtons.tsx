import React from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareButtonsProps {
  text: string;
  url: string;
  size?: 'sm' | 'default';
  className?: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ text, url, size = 'default', className = '' }) => {
  const fullMessage = `${text}\n${url}`;
  const encodedMessage = encodeURIComponent(fullMessage);

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleTelegramShare = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.open(telegramUrl, '_blank');
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        size="icon"
        onClick={handleWhatsAppShare}
        className={`${buttonSize} bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl`}
        title="Share on WhatsApp"
      >
        <MessageCircle className={iconSize} />
      </Button>
      <Button
        size="icon"
        onClick={handleTelegramShare}
        className={`${buttonSize} bg-[#0088cc] hover:bg-[#006699] text-white rounded-xl`}
        title="Share on Telegram"
      >
        <Send className={iconSize} />
      </Button>
    </div>
  );
};

export default ShareButtons;
