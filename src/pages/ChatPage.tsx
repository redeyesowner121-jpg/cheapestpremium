import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  MessageCircle,
  Image as ImageIcon,
  X,
  Reply
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsContext } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  user_id: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
  reply_to_id?: string | null;
}

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, isAdmin, isTempAdmin } = useAuth();
  const { settings } = useAppSettingsContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const whatsappNumber = (settings.contact_whatsapp || '').replace(/[^0-9]/g, '');
  const telegramContact = settings.support_telegram || '';
  const telegramClean = telegramContact.replace(/^@/, '').replace(/^\+/, '');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      loadMessages();
      const channel = supabase
        .channel('chat-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` },
          (payload) => { setMessages(prev => [...prev, payload.new as Message]); }
        ).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (error) return null;
    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;
    setUploading(true);
    let imageUrl: string | null = null;
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage);
      if (!imageUrl) { toast.error('Failed to upload image'); setUploading(false); return; }
    }

    const insertData: any = {
      user_id: user.id,
      message: newMessage.trim() || (selectedImage ? '📷 Photo' : ''),
      is_admin: isAdmin || isTempAdmin,
      image_url: imageUrl
    };
    if (replyTo) insertData.reply_to_id = replyTo.id;

    const { error } = await supabase.from('chat_messages').insert(insertData);
    if (error) { toast.error('Failed to send message'); setUploading(false); return; }

    setNewMessage('');
    setReplyTo(null);
    removeSelectedImage();
    setUploading(false);
    loadMessages();
  };

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const getReplyMessage = (replyId: string) => {
    return messages.find(m => m.id === replyId);
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/10');
      setTimeout(() => el.classList.remove('bg-primary/10'), 1500);
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
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
            <button className="p-2.5 bg-[#25D366]/10 rounded-xl hover:bg-[#25D366]/20 transition-colors" onClick={handleWhatsApp} title="WhatsApp">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </button>
          )}
          {telegramClean && (
            <button className="p-2.5 bg-[#0088cc]/10 rounded-xl hover:bg-[#0088cc]/20 transition-colors" onClick={handleTelegram} title="Telegram">
              <Send className="w-5 h-5 text-[#0088cc]" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
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
            {messages.map((message, index) => {
              const repliedMsg = message.reply_to_id ? getReplyMessage(message.reply_to_id) : null;
              return (
                <motion.div
                  key={message.id}
                  id={`msg-${message.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'} group transition-colors duration-500 rounded-xl`}
                >
                  <div className="max-w-[80%] relative">
                    {/* Reply button on hover */}
                    <button
                      onClick={() => handleReply(message)}
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-muted hover:bg-muted/80 ${
                        message.is_admin ? '-right-8' : '-left-8'
                      }`}
                    >
                      <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {/* Replied message preview */}
                    {repliedMsg && (
                      <div
                        onClick={() => scrollToMessage(repliedMsg.id)}
                        className={`text-[11px] mb-1 px-3 py-1.5 rounded-t-xl cursor-pointer border-l-2 ${
                          message.is_admin
                            ? 'bg-muted/60 border-primary/50 text-muted-foreground'
                            : 'bg-primary/80 border-primary-foreground/40 text-primary-foreground/80'
                        }`}
                      >
                        <span className="font-semibold">{repliedMsg.is_admin ? 'Admin' : 'You'}</span>
                        <p className="truncate">{repliedMsg.message || '📷 Photo'}</p>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-2.5 ${repliedMsg ? 'rounded-t-sm' : ''} ${
                        message.is_admin
                          ? 'bg-card shadow-sm border border-border/50 rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      }`}
                    >
                      {message.image_url && (
                        <img src={message.image_url} alt="Shared" className="rounded-lg mb-2 max-w-full cursor-pointer" onClick={() => window.open(message.image_url, '_blank')} />
                      )}
                      {message.message && message.message !== '📷 Photo' && (
                        <p className={`text-sm leading-relaxed ${message.is_admin ? 'text-foreground' : ''}`}>{message.message}</p>
                      )}
                      <p className={`text-[10px] mt-1 text-right ${message.is_admin ? 'text-muted-foreground' : 'text-primary-foreground/60'}`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Contact bar */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-1">
        <div className="max-w-lg mx-auto">
          <div className="bg-muted/50 rounded-xl px-3 py-1.5 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            {whatsappNumber && (
              <button onClick={handleWhatsApp} className="flex items-center gap-1 hover:text-[#25D366] transition-colors">
                <MessageCircle className="w-3 h-3" /><span>WhatsApp</span>
              </button>
            )}
            {whatsappNumber && telegramClean && <span className="text-border">•</span>}
            {telegramClean && (
              <button onClick={handleTelegram} className="flex items-center gap-1 hover:text-[#0088cc] transition-colors">
                <Send className="w-3 h-3" /><span>Telegram</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-10">
          <div className="max-w-lg mx-auto bg-card border border-border rounded-t-xl px-3 py-2 flex items-center gap-2">
            <Reply className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
              <p className="text-[11px] font-semibold text-primary">{replyTo.is_admin ? 'Admin' : 'You'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📷 Photo'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-muted rounded-full">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className={`fixed ${replyTo ? 'bottom-28' : 'bottom-20'} left-4 right-4 max-w-lg mx-auto z-10`}>
          <div className="bg-card rounded-xl p-2 shadow-card relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
            <button onClick={removeSelectedImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-border px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          <button className="p-2 rounded-full hover:bg-muted transition-colors" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </button>
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 h-10 rounded-full bg-muted border-0"
          />
          <Button size="icon" className="w-10 h-10 rounded-full" onClick={handleSendMessage} disabled={(!newMessage.trim() && !selectedImage) || uploading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
