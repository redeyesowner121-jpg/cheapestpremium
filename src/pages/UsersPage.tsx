import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShoppingBag, 
  TrendingUp,
  Award,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import BlueTick from '@/components/BlueTick';
import { RankBadgeInline } from '@/components/RankBadge';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { getUserRank } from '@/lib/ranks';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_deposit: number;
  total_orders: number;
  has_blue_check: boolean;
  created_at: string;
  rank_balance: number;
  is_reseller: boolean;
}

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userOrders, setUserOrders] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, total_deposit, total_orders, has_blue_check, created_at, rank_balance, is_reseller')
      .order('rank_balance', { ascending: false });

    if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const loadUserOrders = async (userId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, product_name, product_image, total_price, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    setUserOrders(data || []);
  };

  const handleSelectUser = async (user: UserProfile) => {
    setSelectedUser(user);
    await loadUserOrders(user.id);
  };

  const filteredUsers = users.filter((user) =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by rank_balance
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-4">Community</h1>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-card border-0 shadow-card"
            />
          </div>

          {/* Top Users Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              Top Contributors
            </h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {sortedUsers.slice(0, 5).map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectUser(user)}
                  className="flex-shrink-0 w-24 text-center cursor-pointer"
                >
                  <div className="relative inline-block">
                    <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground mx-auto">
                      {user.name?.charAt(0) || 'U'}
                    </div>
                    {user.has_blue_check && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-card rounded-full flex items-center justify-center shadow-card">
                        <BlueTick size="sm" />
                      </div>
                    )}
                    {index < 3 && (
                      <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-amber-400 text-amber-900' :
                        index === 1 ? 'bg-slate-300 text-slate-700' :
                        'bg-amber-600 text-amber-100'
                      }`}>
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-2 truncate">
                    {user.name?.split(' ')[0] || 'User'}
                  </p>
                  <RankBadgeInline rankBalance={user.rank_balance || 0} size="sm" />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ₹{(user.rank_balance || 0).toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* All Users */}
          <h2 className="text-lg font-semibold text-foreground mb-3">All Users ({sortedUsers.length})</h2>
          <div className="space-y-3">
            {sortedUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.03 }}
                onClick={() => handleSelectUser(user)}
                className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                  {user.has_blue_check && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-card rounded-full flex items-center justify-center shadow-sm">
                      <BlueTick size="sm" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground flex items-center gap-1">
                      {user.name || 'User'}
                      {user.has_blue_check && <BlueTick size="sm" />}
                    </h3>
                    <RankBadgeInline rankBalance={user.rank_balance || 0} size="sm" />
                    {user.is_reseller && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        Reseller
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span>₹{(user.rank_balance || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShoppingBag className="w-3 h-3 text-primary" />
                      <span>{user.total_orders || 0} orders</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* User Profile Modal - Instagram Style */}
      {selectedUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setSelectedUser(null)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-full max-w-lg mx-auto bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />

              {/* Profile Header - Instagram Style */}
              <div className="flex items-center gap-6 mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                    {selectedUser.name?.charAt(0) || 'U'}
                  </div>
                  {selectedUser.has_blue_check && (
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 gradient-accent rounded-full flex items-center justify-center">
                      <BlueTick size="sm" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedUser.name || 'User'}
                    {selectedUser.has_blue_check && <BlueTick size="md" />}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    Joined {new Date(selectedUser.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              
              {/* Stats - Instagram Style */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-muted rounded-2xl">
                  <p className="text-2xl font-bold text-success">
                    ₹{(selectedUser.total_deposit || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Deposited</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-2xl">
                  <p className="text-2xl font-bold text-primary">
                    {selectedUser.total_orders || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Orders Placed</p>
                </div>
              </div>

              {/* Recent Activity - Instagram Grid Style */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Recent Orders</h3>
                {userOrders.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {userOrders.map((order) => (
                      <div key={order.id} className="aspect-square relative rounded-lg overflow-hidden">
                        <img 
                          src={order.product_image || 'https://via.placeholder.com/150'} 
                          alt={order.product_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-1 left-1 right-1">
                          <p className="text-[9px] text-white font-medium truncate">{order.product_name}</p>
                          <p className="text-[10px] text-white/80">₹{order.total_price}</p>
                        </div>
                        {order.status === 'completed' && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                            <span className="text-[8px] text-white">✓</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No orders yet</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
};

export default UsersPage;
