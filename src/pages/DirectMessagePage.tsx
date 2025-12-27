import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BlueTick from '@/components/BlueTick';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  image_url?: string;
  is_read: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
  has_blue_check: boolean;
}

const DirectMessagePage: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user && userId) {
      loadOtherUser();
      loadMessages();
      markMessagesAsRead();

      // Subscribe to new messages
      const channel = supabase
        .channel(`dm-${user.id}-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
          },
          (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.sender_id === user.id && newMsg.receiver_id === userId) ||
              (newMsg.sender_id === userId && newMsg.receiver_id === user.id)
            ) {
              setMessages(prev => [...prev, newMsg]);
              if (newMsg.sender_id === userId) {
                markMessagesAsRead();
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadOtherUser = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, has_blue_check')
      .eq('id', userId)
      .single();
    if (data) setOtherUser(data);
  };

  const loadMessages = async () => {
    if (!user || !userId) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
    setLoading(false);
  };

  const markMessagesAsRead = async () => {
    if (!user || !userId) return;
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('sender_id', userId)
      .eq('receiver_id', user.id)
      .eq('is_read', false);
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
    const fileName = `dm/${user?.id}/${Date.now()}.${fileExt}`;
    
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
    if ((!newMessage.trim() && !selectedImage) || !user || !userId) return;

    setSending(true);
    setUploading(selectedImage !== null);

    let imageUrl: string | null = null;
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage);
      if (!imageUrl) {
        toast.error('Failed to upload image');
        setSending(false);
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      message: newMessage.trim() || (selectedImage ? '📷 Photo' : ''),
      image_url: imageUrl
    });

    if (error) {
      toast.error('Failed to send message');
      setSending(false);
      setUploading(false);
      return;
    }

    setNewMessage('');
    removeSelectedImage();
    setSending(false);
    setUploading(false);
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
          
          {otherUser && (
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-primary-foreground font-bold">{otherUser.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-foreground flex items-center gap-1">
                  {otherUser.name}
                  {otherUser.has_blue_check && <BlueTick size="sm" />}
                </h2>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 pt-20 pb-24 px-4 max-w-lg mx-auto w-full overflow-y-auto">
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
            {messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isOwn
                        ? 'gradient-primary text-primary-foreground rounded-tr-none'
                        : 'bg-card shadow-card rounded-tl-none'
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
                      <p className={`text-sm ${!isOwn ? 'text-foreground' : ''}`}>
                        {message.message}
                      </p>
                    )}
                    <p
                      className={`text-[10px] mt-1 text-right ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Image Preview */}
      {imagePreview && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto">
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
            disabled={(!newMessage.trim() && !selectedImage) || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default DirectMessagePage;
