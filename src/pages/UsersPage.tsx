import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShoppingBag, 
  TrendingUp,
  Award,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import BlueTick from '@/components/BlueTick';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

interface UserProfile {
  uid: string;
  name: string;
  photoURL?: string;
  totalDeposit: number;
  totalOrders: number;
  hasBlueCheck: boolean;
  createdAt: number;
}

const mockUsers: UserProfile[] = [
  { uid: '1', name: 'Rahul Kumar', totalDeposit: 5000, totalOrders: 24, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 30 },
  { uid: '2', name: 'Priya Sharma', totalDeposit: 3500, totalOrders: 18, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 45 },
  { uid: '3', name: 'Amit Singh', totalDeposit: 2100, totalOrders: 12, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 20 },
  { uid: '4', name: 'Sneha Patel', totalDeposit: 800, totalOrders: 8, hasBlueCheck: false, createdAt: Date.now() - 86400000 * 15 },
  { uid: '5', name: 'Vikram Reddy', totalDeposit: 4200, totalOrders: 21, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 60 },
  { uid: '6', name: 'Anjali Gupta', totalDeposit: 1500, totalOrders: 9, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 25 },
  { uid: '7', name: 'Sanjay Joshi', totalDeposit: 600, totalOrders: 5, hasBlueCheck: false, createdAt: Date.now() - 86400000 * 10 },
  { uid: '8', name: 'Meera Iyer', totalDeposit: 2800, totalOrders: 15, hasBlueCheck: true, createdAt: Date.now() - 86400000 * 35 },
];

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by total deposit
  const sortedUsers = [...filteredUsers].sort((a, b) => b.totalDeposit - a.totalDeposit);

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
                  key={user.uid}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedUser(user)}
                  className="flex-shrink-0 w-24 text-center cursor-pointer"
                >
                  <div className="relative inline-block">
                    <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-primary-foreground mx-auto">
                      {user.name.charAt(0)}
                    </div>
                    {user.hasBlueCheck && (
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
                    {user.name.split(' ')[0]}
                  </p>
                  <p className="text-xs text-success font-medium">
                    ₹{user.totalDeposit.toLocaleString()}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* All Users */}
          <h2 className="text-lg font-semibold text-foreground mb-3">All Users</h2>
          <div className="space-y-3">
            {sortedUsers.map((user, index) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.03 }}
                onClick={() => setSelectedUser(user)}
                className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                    {user.name.charAt(0)}
                  </div>
                  {user.hasBlueCheck && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-card rounded-full flex items-center justify-center shadow-sm">
                      <BlueTick size="sm" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-foreground flex items-center gap-1">
                    {user.name}
                    {user.hasBlueCheck && <BlueTick size="sm" />}
                  </h3>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span>₹{user.totalDeposit.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShoppingBag className="w-3 h-3 text-primary" />
                      <span>{user.totalOrders} orders</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* User Profile Modal */}
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
            className="w-full max-w-lg mx-auto bg-card rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />

              {/* Profile Header */}
              <div className="text-center">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mx-auto">
                    {selectedUser.name.charAt(0)}
                  </div>
                  {selectedUser.hasBlueCheck && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                      <BlueTick size="md" />
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-foreground mt-4 flex items-center justify-center gap-2">
                  {selectedUser.name}
                  {selectedUser.hasBlueCheck && <BlueTick size="md" />}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Member since {new Date(selectedUser.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-muted rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-success">
                    ₹{selectedUser.totalDeposit.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Deposited</p>
                </div>
                <div className="bg-muted rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {selectedUser.totalOrders}
                  </p>
                  <p className="text-sm text-muted-foreground">Orders Placed</p>
                </div>
              </div>

              {/* Recent Activity Placeholder */}
              <div className="mt-6">
                <h3 className="font-semibold text-foreground mb-3">Recent Activity</h3>
                <div className="space-y-3">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="w-12 h-12 rounded-lg bg-card" />
                      <div className="flex-1">
                        <div className="h-3 w-24 bg-card rounded" />
                        <div className="h-2 w-16 bg-card rounded mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
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
