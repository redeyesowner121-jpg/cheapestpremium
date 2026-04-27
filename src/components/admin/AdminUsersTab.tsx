import React, { useState } from 'react';
import { Users, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import AdminAdvancedFilters from './AdminAdvancedFilters';
import { userSortOptions, userTypeFilters } from './users-tab/constants';
import { useUserFilters } from './users-tab/useUserFilters';
import UserCard from './users-tab/UserCard';
import ResetPasswordModal from './users-tab/ResetPasswordModal';

interface AdminUsersTabProps {
  users: any[];
  onSelectUser: (user: any) => void;
  onRefresh?: () => void;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ users, onSelectUser, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [userFilter, setUserFilter] = useState('all');
  const [depositRange, setDepositRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);

  const filteredUsers = useUserFilters(users, { searchQuery, userFilter, sortBy, depositRange });

  const totalDeposit = users.reduce((sum, u) => sum + (u.total_deposit || 0), 0);
  const activeUsers = users.filter(u => (u.total_orders || 0) > 0).length;
  const resellersCount = users.filter(u => u.is_reseller).length;

  const userFilterButtons = (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="w-3 h-3" />User Type
      </label>
      <div className="flex gap-2 flex-wrap">
        {userTypeFilters.map((filter) => (
          <button key={filter.value} onClick={() => setUserFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              userFilter === filter.value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'
            }`}>
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );

  const depositRangeFilter = (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />Total Deposit Range (₹)
      </label>
      <div className="flex gap-2">
        <Input type="number" placeholder="Min" value={depositRange.min}
          onChange={(e) => setDepositRange({ ...depositRange, min: e.target.value })}
          className="h-8 text-xs" />
        <Input type="number" placeholder="Max" value={depositRange.max}
          onChange={(e) => setDepositRange({ ...depositRange, max: e.target.value })}
          className="h-8 text-xs" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-foreground">{users.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Users</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-primary">₹{totalDeposit.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Total Deposits</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center shadow-card">
          <p className="text-lg font-bold text-success">{activeUsers}</p>
          <p className="text-[10px] text-muted-foreground">Active Buyers</p>
        </div>
      </div>

      <AdminAdvancedFilters
        config={{
          searchPlaceholder: 'Search by name, email, phone...',
          showSortOptions: true,
          sortOptions: userSortOptions,
          customFilters: (
            <div className="space-y-4">
              {userFilterButtons}
              {depositRangeFilter}
            </div>
          ),
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <p className="text-xs text-muted-foreground">
        Showing {filteredUsers.length} of {users.length} users
        {resellersCount > 0 && <span className="ml-2">• {resellersCount} resellers</span>}
      </p>

      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No users found matching your filters</p>
          </div>
        ) : (
          filteredUsers.map((user: any) => (
            <UserCard key={user.id} user={user} onSelect={onSelectUser}
              onResetPassword={setResetPasswordUser} onRefresh={onRefresh} />
          ))
        )}
      </div>

      <ResetPasswordModal user={resetPasswordUser} onClose={() => setResetPasswordUser(null)} />
    </div>
  );
};

export default AdminUsersTab;
