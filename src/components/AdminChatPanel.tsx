import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Reply, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminChat, Message } from './admin-chat/useAdminChat';
import UsersList from './admin-chat/UsersList';
import MessageBubble from './admin-chat/MessageBubble';

const AdminChatPanel: React.FC = () => {
  const { chatUsers, selectedUser, setSelectedUser, messages, loading, sendMessage, selectUser } = useAdminChat();
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const ok = await sendMessage(newMessage, replyTo?.id || null);
    if (ok) { setNewMessage(''); setReplyTo(null); }
  };

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
        <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 border-r border-border`}>
          <UsersList
            users={chatUsers}
            selectedId={selectedUser?.id}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            onSelect={selectUser}
          />
        </div>

        <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
          {selectedUser ? (
            <>
              <div className="flex items-center gap-3 p-3 border-b border-border">
                <button onClick={() => setSelectedUser(null)} className="md:hidden p-1">
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

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((message, index) => {
                  const repliedMsg = message.reply_to_id ? messages.find(m => m.id === message.reply_to_id) || null : null;
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      index={index}
                      repliedMsg={repliedMsg}
                      selectedUserName={selectedUser.name}
                      onReply={(m) => { setReplyTo(m); adminInputRef.current?.focus(); }}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {replyTo && (
                <div className="px-3 pt-2 border-t border-border flex items-center gap-2 bg-card">
                  <Reply className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                    <p className="text-[10px] font-semibold text-primary">{replyTo.is_admin ? 'You' : selectedUser?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📷 Photo'}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-muted rounded-full">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  ref={adminInputRef}
                  placeholder="Type a reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!newMessage.trim()} className="btn-gradient">
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
