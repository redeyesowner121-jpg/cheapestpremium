import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BlueTick from '@/components/BlueTick';

interface AdminUsersTabProps {
  users: any[];
  onSelectUser: (user: any) => void;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ users, onSelectUser }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Search users..." 
          className="pl-12 h-12 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user: any) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  {user.name}
                  {user.has_blue_check && <BlueTick size="sm" />}
                </p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Balance: ₹{user.wallet_balance || 0}</span>
                  <span>Deposit: ₹{user.total_deposit || 0}</span>
                  <span>Orders: {user.total_orders || 0}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Joined: {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectUser(user)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminUsersTab;
