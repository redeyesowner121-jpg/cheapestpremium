import React from 'react';
import { Search, Ban, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BotUsersTabProps {
  users: any[];
  usersPage: number;
  usersTotal: number;
  userSearch: string;
  setUserSearch: (v: string) => void;
  fetchUsers: (page: number, search: string) => void;
  fetchUserDetail: (tgId: number) => void;
  toggleBan: (tgId: number, ban: boolean) => void;
}

const BotUsersTab: React.FC<BotUsersTabProps> = ({
  users, usersPage, usersTotal, userSearch, setUserSearch,
  fetchUsers, fetchUserDetail, toggleBan,
}) => (
  <div className="space-y-3">
    <div className="flex gap-2">
      <Input placeholder="Search by username, name or ID..." value={userSearch}
        onChange={e => setUserSearch(e.target.value)} className="rounded-xl" />
      <Button size="sm" className="rounded-xl" onClick={() => fetchUsers(0, userSearch)}>
        <Search className="w-4 h-4" />
      </Button>
    </div>

    <div className="bg-card rounded-2xl border border-border p-3">
      <p className="text-sm font-semibold mb-2">
        👥 Users ({usersTotal}) — Page {usersPage + 1}/{Math.ceil(usersTotal / 20) || 1}
      </p>
      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {users.map((u: any) => (
          <div key={u.telegram_id}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition"
            onClick={() => fetchUserDetail(u.telegram_id)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {u.username ? `@${u.username}` : u.first_name || 'Unknown'}
                {u.is_banned && <span className="text-red-500 ml-1">🚫</span>}
              </p>
              <p className="text-xs text-muted-foreground"><code>{u.telegram_id}</code></p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg"
                onClick={e => { e.stopPropagation(); toggleBan(u.telegram_id, !u.is_banned); }}>
                {u.is_banned ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Ban className="w-3.5 h-3.5 text-red-500" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg"
                onClick={e => { e.stopPropagation(); fetchUserDetail(u.telegram_id); }}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {usersPage > 0 && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => fetchUsers(usersPage - 1, userSearch)}>⬅️ Prev</Button>}
        {usersPage < Math.ceil(usersTotal / 20) - 1 && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => fetchUsers(usersPage + 1, userSearch)}>Next ➡️</Button>}
      </div>
    </div>
  </div>
);

export default BotUsersTab;
