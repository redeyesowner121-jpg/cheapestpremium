import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from './users/types';
import { TopContributors } from './users/TopContributors';
import { UserCard } from './users/UserCard';
import { UserProfileSheet } from './users/UserProfileSheet';

const UsersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userOrders, setUserOrders] = useState<any[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, total_deposit, total_orders, has_blue_check, created_at, rank_balance, is_reseller')
        .order('rank_balance', { ascending: false });
      if (data) setUsers(data as any);
      setLoading(false);
    };
    loadUsers();
  }, []);

  const handleSelectUser = async (user: UserProfile) => {
    setSelectedUser(user);
    const { data } = await supabase
      .from('orders')
      .select('id, product_name, product_image, total_price, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);
    setUserOrders(data || []);
  };

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => (b.rank_balance || 0) - (a.rank_balance || 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-4">Community</h1>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-card border-0 shadow-card"
            />
          </div>

          <TopContributors users={sortedUsers} onSelect={handleSelectUser} />

          <h2 className="text-lg font-semibold text-foreground mb-3">All Users ({sortedUsers.length})</h2>
          <div className="space-y-3">
            {sortedUsers.map((user, index) => (
              <UserCard key={user.id} user={user} index={index} onSelect={handleSelectUser} />
            ))}
          </div>
        </motion.div>
      </main>

      {selectedUser && (
        <UserProfileSheet user={selectedUser} orders={userOrders} onClose={() => setSelectedUser(null)} />
      )}

      <BottomNav />
    </div>
  );
};

export default UsersPage;
