import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  Phone,
  PhoneCall,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  user_id: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
}

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, isAdmin, isTempAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      loadMessages();
      
      // Subscribe to realtime messages
      const channel = supabase
        .channel('chat-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    setUploading(true);
    let imageUrl: string | null = null;

    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage);
      if (!imageUrl) {
        toast.error('Failed to upload image');
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      message: newMessage.trim() || (selectedImage ? '📷 Photo' : ''),
      is_admin: isAdmin || isTempAdmin,
      image_url: imageUrl
    });

    if (error) {
      toast.error('Failed to send message');
      setUploading(false);
      return;
    }

    setNewMessage('');
    removeSelectedImage();
    setUploading(false);
    loadMessages();
  };

  const handleCall = () => {
    window.open('tel:+918900684167', '_self');
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/918900684167', '_blank');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold">A</span>
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Admin Support</h2>
              <p className="text-xs text-success">Online</p>
            </div>
          </div>

          <button 
            className="p-2 bg-success/10 rounded-xl"
            onClick={handleWhatsApp}
          >
            <Phone className="w-5 h-5 text-success" />
          </button>
          <button 
            className="p-2 bg-primary/10 rounded-xl"
            onClick={handleCall}
          >
            <PhoneCall className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 pt-20 pb-36 px-4 max-w-lg mx-auto w-full overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No messages yet. Start a conversation!</p>
              </div>
            )}
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex ${message.is_admin ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.is_admin
                      ? 'bg-card shadow-card rounded-tl-none'
                      : 'gradient-primary text-primary-foreground rounded-tr-none'
                  }`}
                >
                  {message.image_url && (
                    <img 
                      src={message.image_url} 
                      alt="Shared" 
                      className="rounded-lg mb-2 max-w-full cursor-pointer"
                      onClick={() => window.open(message.image_url, '_blank')}
                    />
                  )}
                  {message.message && message.message !== '📷 Photo' && (
                    <p className={`text-sm ${message.is_admin ? 'text-foreground' : ''}`}>
                      {message.message}
                    </p>
                  )}
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      message.is_admin ? 'text-muted-foreground' : 'text-primary-foreground/70'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Contact Info */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-accent/10 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              📞 Call/WhatsApp: <span className="font-semibold text-primary">+91 8900684167</span>
            </p>
          </div>
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto">
          <div className="bg-card rounded-xl p-2 shadow-card relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
            <button 
              onClick={removeSelectedImage}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button 
            className="p-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 h-10 rounded-full bg-muted border-0"
          />
          
          <Button
            size="icon"
            className="w-10 h-10 rounded-full btn-gradient"
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedImage) || uploading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
