import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, User, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  message: string;
  user_id: string;
  is_admin: boolean;
  created_at: string;
  image_url?: string;
}

const AdminChatPanel: React.FC = () => {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatUsers();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('admin-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadChatUsers();
          if (selectedUser) {
            loadMessages(selectedUser.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatUsers = async () => {
    setLoading(true);
    
    // Get all unique users who have sent messages
    const { data: messagesData } = await supabase
      .from('chat_messages')
      .select('user_id, message, created_at, is_admin')
      .order('created_at', { ascending: false });

    if (messagesData) {
      const userMap = new Map<string, { lastMessage: string; lastTime: string; unread: number }>();
      
      messagesData.forEach(msg => {
        if (!userMap.has(msg.user_id)) {
          userMap.set(msg.user_id, {
            lastMessage: msg.message,
            lastTime: msg.created_at,
            unread: msg.is_admin ? 0 : 1
          });
        } else if (!msg.is_admin) {
          const current = userMap.get(msg.user_id)!;
          userMap.set(msg.user_id, { ...current, unread: current.unread + 1 });
        }
      });

      const userIds = Array.from(userMap.keys());
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        if (profiles) {
          const users: ChatUser[] = profiles.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            lastMessage: userMap.get(p.id)?.lastMessage,
            lastMessageTime: userMap.get(p.id)?.lastTime,
            unreadCount: userMap.get(p.id)?.unread || 0
          }));

          // Sort by last message time
          users.sort((a, b) => {
            const timeA = new Date(a.lastMessageTime || 0).getTime();
            const timeB = new Date(b.lastMessageTime || 0).getTime();
            return timeB - timeA;
          });

          setChatUsers(users);
        }
      }
    }
    setLoading(false);
  };

  const loadMessages = async (userId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    loadMessages(user.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    const { error } = await supabase.from('chat_messages').insert({
      user_id: selectedUser.id,
      message: newMessage.trim(),
      is_admin: true
    });

    if (error) {
      toast.error('Failed to send message');
      return;
    }

    // Send notification to user
    await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      title: 'New Message from Admin',
      message: newMessage.trim().substring(0, 100),
      type: 'chat'
    });

    setNewMessage('');
    loadMessages(selectedUser.id);
    loadChatUsers();
    toast.success('Message sent!');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredUsers = chatUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden" style={{ height: '500px' }}>
      <div className="flex h-full">
        {/* Users List */}
        <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 border-r border-border`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No chats yet</p>
              </div>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted transition-colors ${
                    selectedUser?.id === user.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{user.name}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {user.lastMessageTime && formatTime(user.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.lastMessage}</p>
                  </div>
                  {user.unreadCount && user.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {user.unreadCount}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-3 border-b border-border">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden p-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                  {selectedUser.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedUser.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex ${message.is_admin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                        message.is_admin
                          ? 'gradient-primary text-primary-foreground rounded-tr-none'
                          : 'bg-muted rounded-tl-none'
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
                        <p className="text-sm">{message.message}</p>
                      )}
                      <p className={`text-[10px] mt-1 text-right ${
                        message.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  placeholder="Type a reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="btn-gradient"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p>Select a chat to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChatPanel;
