import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, 
  ArrowLeft, 
  Phone,
  MoreVertical,
  Image,
  Paperclip
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  isAdmin: boolean;
}

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Welcome to RKR Premium Store! How can I help you today?',
      senderId: 'admin',
      senderName: 'Admin',
      timestamp: Date.now() - 3600000,
      isAdmin: true,
    },
    {
      id: '2',
      text: 'Hi! I have a question about my order.',
      senderId: 'user',
      senderName: 'User',
      timestamp: Date.now() - 3500000,
      isAdmin: false,
    },
    {
      id: '3',
      text: 'Sure! Please share your order ID and I\'ll look into it for you.',
      senderId: 'admin',
      senderName: 'Admin',
      timestamp: Date.now() - 3400000,
      isAdmin: true,
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      text: newMessage,
      senderId: userData?.uid || 'user',
      senderName: userData?.name || 'User',
      timestamp: Date.now(),
      isAdmin: false,
    };

    setMessages([...messages, message]);
    setNewMessage('');

    // Simulate admin response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Thank you for your message! Our team will respond shortly.',
          senderId: 'admin',
          senderName: 'Admin',
          timestamp: Date.now(),
          isAdmin: true,
        },
      ]);
    }, 1000);
  };

  const formatTime = (timestamp: number) => {
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

          <button className="p-2">
            <Phone className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 pt-20 pb-20 px-4 max-w-lg mx-auto w-full overflow-y-auto">
        <div className="space-y-4 py-4">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${message.isAdmin ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.isAdmin
                    ? 'bg-card shadow-card rounded-tl-none'
                    : 'gradient-primary text-primary-foreground rounded-tr-none'
                }`}
              >
                <p className={`text-sm ${message.isAdmin ? 'text-foreground' : ''}`}>
                  {message.text}
                </p>
                <p
                  className={`text-[10px] mt-1 text-right ${
                    message.isAdmin ? 'text-muted-foreground' : 'text-primary-foreground/70'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Contact Info */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-accent/10 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              WhatsApp: +918900684167 (WhatsApp only)
            </p>
          </div>
        </div>
      </div>
              WhatsApp: +91 890068416 or +91 8075101327
            </p>
          </div>
        </div>
      </div>

      {/* Input */}
      <footer className="fixed bottom-0 left-0 right-0 glass border-t border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button className="p-2">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <button className="p-2">
            <Image className="w-5 h-5 text-muted-foreground" />
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
            disabled={!newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
