import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import BlueTick from '@/components/BlueTick';
import BottomNav from '@/components/BottomNav';

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  otherUserBlueTick: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadConversations();

      // Subscribe to new messages
      const channel = supabase
        .channel('inbox-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);

    // Get all messages where user is sender or receiver
    const { data: messages } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!messages) {
      setLoading(false);
      return;
    }

    // Group by conversation partner
    const conversationMap = new Map<string, {
      lastMessage: typeof messages[0];
      unreadCount: number;
    }>();

    messages.forEach((msg) => {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          lastMessage: msg,
          unreadCount: 0
        });
      }

      // Count unread messages (received and not read)
      if (msg.receiver_id === user.id && !msg.is_read) {
        const conv = conversationMap.get(partnerId)!;
        conv.unreadCount++;
      }
    });

    // Fetch user profiles for all partners
    const partnerIds = Array.from(conversationMap.keys());
    
    if (partnerIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, has_blue_check')
      .in('id', partnerIds);

    // Build conversation list
    const convList: Conversation[] = [];
    conversationMap.forEach((value, partnerId) => {
      const profile = profiles?.find(p => p.id === partnerId);
      convList.push({
        id: partnerId,
        otherUserId: partnerId,
        otherUserName: profile?.name || 'User',
        otherUserAvatar: profile?.avatar_url,
        otherUserBlueTick: profile?.has_blue_check || false,
        lastMessage: value.lastMessage.message,
        lastMessageTime: value.lastMessage.created_at,
        unreadCount: value.unreadCount
      });
    });

    // Sort by last message time
    convList.sort((a, b) => 
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    setConversations(convList);
    setLoading(false);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.otherUserName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-muted-foreground">{totalUnread} unread</p>
            )}
          </div>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl bg-card border-0 shadow-card"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No messages yet</h2>
            <p className="text-muted-foreground text-sm">
              Start a conversation from the Community tab
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv, index) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/dm/${conv.otherUserId}`)}
                className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover cursor-pointer"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center overflow-hidden">
                    {conv.otherUserAvatar ? (
                      <img 
                        src={conv.otherUserAvatar} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-primary-foreground">
                        {conv.otherUserName.charAt(0)}
                      </span>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-foreground">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h3 className={`font-semibold truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground'}`}>
                      {conv.otherUserName}
                    </h3>
                    {conv.otherUserBlueTick && <BlueTick size="sm" />}
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conv.lastMessage}
                  </p>
                </div>

                {/* Time */}
                <div className="text-right">
                  <p className={`text-xs ${conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {formatTime(conv.lastMessageTime)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default MessagesPage;
