import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { toast } from 'sonner';
import { useChatMessages } from './chat/useChatMessages';
import { ChatMessage } from './chat/types';
import ChatHeader from './chat/ChatHeader';
import ChatMessageBubble from './chat/ChatMessageBubble';
import ChatInputBar from './chat/ChatInputBar';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettingsContext();
  const { messages, loading, sendMessage } = useChatMessages(user, isAdmin, isTempAdmin);

  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const whatsappNumber = (settings.contact_whatsapp || '').replace(/[^0-9]/g, '');
  const telegramContact = settings.support_telegram || '';
  const telegramClean = telegramContact.replace(/^@/, '').replace(/^\+/, '');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSend = async () => {
    setUploading(true);
    const ok = await sendMessage(newMessage, selectedImage, replyTo?.id || null);
    setUploading(false);
    if (ok) {
      setNewMessage('');
      setReplyTo(null);
      removeSelectedImage();
    }
  };

  const handleWhatsApp = () => {
    if (whatsappNumber) window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    else toast.error('WhatsApp number not configured');
  };

  const handleTelegram = () => {
    if (telegramClean) {
      const isPhone = /^\d+$/.test(telegramClean);
      window.open(isPhone ? `https://t.me/+${telegramClean}` : `https://t.me/${telegramClean}`, '_blank');
    } else toast.error('Telegram contact not configured');
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/10');
      setTimeout(() => el.classList.remove('bg-primary/10'), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ChatHeader
        whatsappNumber={whatsappNumber}
        telegramClean={telegramClean}
        onBack={() => navigate(-1)}
        onWhatsApp={handleWhatsApp}
        onTelegram={handleTelegram}
      />

      <main className="flex-1 pt-20 pb-28 px-4 max-w-lg mx-auto w-full overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm mb-1">No messages yet</p>
                <p className="text-muted-foreground/60 text-xs">Send a message to start a conversation with admin</p>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                index={i}
                repliedMsg={m.reply_to_id ? messages.find(x => x.id === m.reply_to_id) || null : null}
                onReply={setReplyTo}
                onScrollToReply={scrollToMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <ChatInputBar
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        uploading={uploading}
        selectedImage={selectedImage}
        imagePreview={imagePreview}
        onImageSelect={handleImageSelect}
        onRemoveImage={removeSelectedImage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        whatsappNumber={whatsappNumber}
        telegramClean={telegramClean}
        onWhatsApp={handleWhatsApp}
        onTelegram={handleTelegram}
      />
    </div>
  );
};

export default ChatPage;
