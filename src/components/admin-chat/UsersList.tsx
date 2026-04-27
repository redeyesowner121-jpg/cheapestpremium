import React from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ChatUser } from './useAdminChat';
import { formatChatTime } from './formatTime';

interface Props {
  users: ChatUser[];
  selectedId?: string;
  searchQuery: string;
  onSearch: (v: string) => void;
  onSelect: (u: ChatUser) => void;
}

const UsersList: React.FC<Props> = ({ users, selectedId, searchQuery, onSearch, onSelect }) => {
  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={searchQuery}
            onChange={(e) => onSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chats yet</p>
          </div>
        ) : (
          filtered.map(user => (
            <div key={user.id} onClick={() => onSelect(user)}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted transition-colors ${selectedId === user.id ? 'bg-muted' : ''}`}>
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {user.lastMessageTime && formatChatTime(user.lastMessageTime)}
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
    </>
  );
};

export default UsersList;
