import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, Users, Shield, CheckCircle, XCircle, Package, Wallet, Send, Radio, Settings, Crown, Search, Ban, UserPlus, UserMinus, DollarSign, Megaphone, Hash, Plus, Minus, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Tab = 'overview' | 'users' | 'wallet' | 'channels' | 'settings' | 'broadcast' | 'owner';

const AdminTelegramBot: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);

  // Wallet state
  const [walletTgId, setWalletTgId] = useState('');
  const [walletAmount, setWalletAmount] = useState('');

  // Channel state
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState('');

  // Broadcast
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsCategory, setSettingsCategory] = useState('payment');
  const [editingKey, setEditingKey] = useState('');
  const [editingValue, setEditingValue] = useState('');

  // Owner
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminId, setNewAdminId] = useState('');

  const SETTINGS_DEFS: Record<string, { key: string; label: string; emoji: string }[]> = {
    payment: [
      { key: 'upi_id', label: 'UPI ID', emoji: '💳' },
      { key: 'upi_name', label: 'UPI Name', emoji: '👤' },
      { key: 'binance_id', label: 'Binance Pay ID', emoji: '🔶' },
      { key: 'binance_contact', label: 'Binance Contact', emoji: '📞' },
      { key: 'min_deposit_amount', label: 'Min Deposit', emoji: '⬇️' },
      { key: 'max_deposit_amount', label: 'Max Deposit', emoji: '⬆️' },
    ],
    bonus: [
      { key: 'referral_bonus', label: 'Referral Bonus', emoji: '🎁' },
      { key: 'min_referral_amount', label: 'Min Referral Order', emoji: '📊' },
      { key: 'daily_bonus_min', label: 'Daily Bonus Min', emoji: '🎰' },
      { key: 'daily_bonus_max', label: 'Daily Bonus Max', emoji: '🎯' },
      { key: 'reseller_commission', label: 'Reseller Commission %', emoji: '💵' },
      { key: 'first_purchase_bonus', label: '1st Purchase Bonus', emoji: '🎊' },
    ],
    store: [
      { key: 'app_name', label: 'Store Name', emoji: '🏪' },
      { key: 'app_tagline', label: 'Tagline', emoji: '✨' },
      { key: 'app_url', label: 'App URL', emoji: '🌐' },
      { key: 'bot_username', label: 'Bot Username', emoji: '🤖' },
      { key: 'currency_symbol', label: 'Currency Symbol', emoji: '💱' },
      { key: 'support_contact', label: 'Support Contact', emoji: '📞' },
    ],
    bot: [
      { key: 'bot_welcome_message', label: 'Welcome Message', emoji: '👋' },
      { key: 'bot_maintenance', label: 'Maintenance Mode', emoji: '🔧' },
      { key: 'auto_confirm_orders', label: 'Auto Confirm', emoji: '⚡' },
      { key: 'ai_enabled', label: 'AI Auto Reply', emoji: '🤖' },
    ],
    security: [
      { key: 'maintenance_mode', label: 'Site Maintenance', emoji: '🚧' },
      { key: 'max_orders_per_day', label: 'Max Orders/Day', emoji: '📦' },
      { key: 'min_wallet_pay', label: 'Min Wallet Pay', emoji: '💳' },
      { key: 'max_wallet_balance', label: 'Max Wallet Balance', emoji: '💰' },
    ],
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [usersRes, ordersRes, pendingRes, confirmedRes, walletsRes, resellersRes, walletBalRes] = await Promise.all([
        supabase.from('telegram_bot_users' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('telegram_wallets' as any).select('*', { count: 'exact', head: true }),
        supabase.from('telegram_wallets' as any).select('*', { count: 'exact', head: true }).eq('is_reseller', true),
        supabase.from('telegram_wallets' as any).select('balance'),
      ]);

      const totalBalance = ((walletBalRes.data as any[]) || []).reduce((s: number, w: any) => s + (w.balance || 0), 0);

      // Today stats
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [todayOrdersRes, todayRevenueRes] = await Promise.all([
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('telegram_orders' as any).select('amount').eq('status', 'confirmed').gte('created_at', today.toISOString()),
      ]);
      const todayRevenue = ((todayRevenueRes.data as any[]) || []).reduce((s: number, o: any) => s + (o.amount || 0), 0);

      // All-time revenue
      const { data: allConfirmed } = await supabase.from('telegram_orders' as any).select('amount').eq('status', 'confirmed');
      const allRevenue = ((allConfirmed as any[]) || []).reduce((s: number, o: any) => s + (o.amount || 0), 0);

      setStats({
        totalUsers: (usersRes as any).count || 0,
        totalOrders: (ordersRes as any).count || 0,
        pendingOrders: (pendingRes as any).count || 0,
        confirmedOrders: (confirmedRes as any).count || 0,
        totalWallets: (walletsRes as any).count || 0,
        totalResellers: (resellersRes as any).count || 0,
        totalBalance,
        todayOrders: (todayOrdersRes as any).count || 0,
        todayRevenue,
        allRevenue,
      });
    } catch { toast.error('Failed to load stats'); }
    setLoading(false);
  };

  const fetchUsers = async (page = 0, search = '') => {
    const PAGE_SIZE = 20;
    let query = supabase.from('telegram_bot_users' as any)
      .select('telegram_id, username, first_name, last_name, is_banned, last_active, created_at', { count: 'exact' })
      .order('last_active', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,telegram_id.eq.${parseInt(search) || 0}`);
    }

    const { data, count } = await query;
    setUsers((data as any[]) || []);
    setUsersTotal(count || 0);
    setUsersPage(page);
  };

  const fetchUserDetail = async (tgId: number) => {
    const [walletRes, ordersRes, userRes] = await Promise.all([
      supabase.from('telegram_wallets' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
      supabase.from('telegram_orders' as any).select('*').eq('telegram_user_id', tgId).order('created_at', { ascending: false }).limit(20),
      supabase.from('telegram_bot_users' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
    ]);
    setSelectedUser({ ...((userRes.data as any) || {}), wallet: (walletRes.data as any), });
    setUserHistory((ordersRes.data as any[]) || []);
    setShowUserModal(true);
  };

  const toggleBan = async (tgId: number, ban: boolean) => {
    await supabase.from('telegram_bot_users' as any).update({ is_banned: ban } as any).eq('telegram_id', tgId);
    toast.success(ban ? `🚫 User ${tgId} banned` : `✅ User ${tgId} unbanned`);
    fetchUsers(usersPage, userSearch);
    if (showUserModal) fetchUserDetail(tgId);
  };

  const toggleReseller = async (tgId: number) => {
    const { data: wallet } = await supabase.from('telegram_wallets' as any).select('is_reseller').eq('telegram_id', tgId).maybeSingle();
    const newStatus = !((wallet as any)?.is_reseller);
    await supabase.from('telegram_wallets' as any).update({ is_reseller: newStatus } as any).eq('telegram_id', tgId);
    toast.success(newStatus ? '✅ Reseller granted' : '❌ Reseller removed');
    if (showUserModal) fetchUserDetail(tgId);
  };

  const handleWalletAction = async (action: 'add' | 'deduct') => {
    const tgId = parseInt(walletTgId);
    const amount = parseFloat(walletAmount);
    if (!tgId || !amount || amount <= 0) { toast.error('Enter valid TG ID and amount'); return; }

    const { data: wallet } = await supabase.from('telegram_wallets' as any).select('balance').eq('telegram_id', tgId).maybeSingle();
    if (!wallet && action === 'deduct') { toast.error('User has no wallet'); return; }
    const currentBal = (wallet as any)?.balance || 0;

    if (action === 'deduct' && currentBal < amount) { toast.error(`Insufficient balance: ₹${currentBal}`); return; }

    const newBal = action === 'add' ? currentBal + amount : currentBal - amount;
    await supabase.from('telegram_wallets' as any).update({ balance: newBal, updated_at: new Date().toISOString() } as any).eq('telegram_id', tgId);
    await supabase.from('telegram_wallet_transactions' as any).insert({
      telegram_id: tgId,
      amount: action === 'add' ? amount : -amount,
      type: action === 'add' ? 'admin_credit' : 'admin_deduction',
      description: `Admin ${action === 'add' ? 'added' : 'deducted'} ₹${amount}`,
    } as any);

    toast.success(`${action === 'add' ? '➕' : '➖'} ₹${amount} ${action === 'add' ? 'added to' : 'deducted from'} ${tgId}. New: ₹${newBal}`);
    setWalletTgId(''); setWalletAmount('');
  };

  const fetchChannels = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'required_channels').maybeSingle();
    try { setChannels(JSON.parse(data?.value || '[]')); } catch { setChannels([]); }
  };

  const addChannel = async () => {
    if (!newChannel.trim()) return;
    const ch = newChannel.startsWith('@') ? newChannel : `@${newChannel}`;
    const updated = [...channels, ch];
    await supabase.from('app_settings').upsert({ key: 'required_channels', value: JSON.stringify(updated), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setChannels(updated); setNewChannel('');
    toast.success(`✅ ${ch} added`);
  };

  const removeChannel = async (ch: string) => {
    const updated = channels.filter(c => c !== ch);
    await supabase.from('app_settings').upsert({ key: 'required_channels', value: JSON.stringify(updated), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setChannels(updated);
    toast.success(`✅ ${ch} removed`);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    const map: Record<string, string> = {};
    (data || []).forEach((s: any) => { map[s.key] = s.value || ''; });
    setSettings(map);
  };

  const saveSetting = async (key: string, value: string) => {
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSettings(prev => ({ ...prev, [key]: value }));
    setEditingKey('');
    toast.success('✅ Setting saved');
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from('telegram_bot_admins' as any).select('telegram_id, created_at').order('created_at', { ascending: true });
    const adminsWithNames = [];
    for (const a of ((data as any[]) || [])) {
      const { data: u } = await supabase.from('telegram_bot_users' as any).select('username, first_name').eq('telegram_id', a.telegram_id).maybeSingle();
      adminsWithNames.push({ ...a, name: (u as any)?.username ? `@${(u as any).username}` : (u as any)?.first_name || 'Unknown' });
    }
    setAdmins(adminsWithNames);
  };

  const addAdmin = async () => {
    const tgId = parseInt(newAdminId);
    if (!tgId) { toast.error('Enter valid Telegram ID'); return; }
    const { data: existing } = await supabase.from('telegram_bot_admins' as any).select('id').eq('telegram_id', tgId).maybeSingle();
    if (existing) { toast.error('Already admin'); return; }
    await supabase.from('telegram_bot_admins' as any).insert({ telegram_id: tgId, added_by: 6898461453 } as any);
    toast.success(`✅ Admin ${tgId} added`);
    setNewAdminId(''); fetchAdmins();
  };

  const removeAdmin = async (tgId: number) => {
    if (tgId === 6898461453) { toast.error('Cannot remove super admin'); return; }
    await supabase.from('telegram_bot_admins' as any).delete().eq('telegram_id', tgId);
    toast.success(`✅ Admin ${tgId} removed`);
    fetchAdmins();
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) { toast.error('Enter a message'); return; }
    setBroadcasting(true);
    const { data: allUsers } = await supabase.from('telegram_bot_users' as any).select('telegram_id').eq('is_banned', false);
    // Note: actual broadcast goes through bot; this is a simulation showing count
    toast.success(`📢 Broadcast message ready for ${(allUsers as any[])?.length || 0} users. Use /broadcast in the bot.`);
    setBroadcasting(false);
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => {
    if (tab === 'users') fetchUsers(0, userSearch);
    if (tab === 'channels') fetchChannels();
    if (tab === 'settings') fetchSettings();
    if (tab === 'owner') fetchAdmins();
  }, [tab]);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: Bot },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
    { key: 'channels', label: 'Channels', icon: Radio },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { key: 'owner', label: 'Owner', icon: Crown },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'ghost'}
            className="rounded-xl gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {/* === OVERVIEW === */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border border-blue-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-xl"><Bot className="w-6 h-6 text-blue-500" /></div>
                <div>
                  <h3 className="font-bold text-foreground">Selling Bot</h3>
                  <p className="text-xs text-muted-foreground">@Air1_Premium_bot</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchStats} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Users', value: stats?.totalUsers || 0, color: 'text-blue-500' },
                { label: 'Orders', value: stats?.totalOrders || 0, color: 'text-purple-500' },
                { label: 'Pending', value: stats?.pendingOrders || 0, color: 'text-yellow-500' },
                { label: 'Confirmed', value: stats?.confirmedOrders || 0, color: 'text-green-500' },
                { label: 'Resellers', value: stats?.totalResellers || 0, color: 'text-cyan-500' },
                { label: 'Wallet Total', value: `₹${stats?.totalBalance || 0}`, color: 'text-orange-500' },
              ].map((s, i) => (
                <div key={i} className="bg-background/50 rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">📊 Revenue</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">₹{stats?.todayRevenue || 0}</p>
                  <p className="text-xs text-muted-foreground">Today ({stats?.todayOrders || 0} orders)</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">₹{stats?.allRevenue || 0}</p>
                  <p className="text-xs text-muted-foreground">All Time</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === USERS === */}
      {tab === 'users' && (
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
      )}

      {/* === WALLET === */}
      {tab === 'wallet' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Wallet Management</h4>
            <Input placeholder="Telegram ID" value={walletTgId} onChange={e => setWalletTgId(e.target.value)} className="rounded-xl" />
            <Input placeholder="Amount (₹)" type="number" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} className="rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <Button className="rounded-xl bg-green-600 hover:bg-green-700" onClick={() => handleWalletAction('add')}>
                <Plus className="w-4 h-4 mr-1" /> Add Balance
              </Button>
              <Button variant="destructive" className="rounded-xl" onClick={() => handleWalletAction('deduct')}>
                <Minus className="w-4 h-4 mr-1" /> Deduct Balance
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === CHANNELS === */}
      {tab === 'channels' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Required Channels ({channels.length})</h4>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channels — users can use bot freely</p>
            ) : channels.map((ch, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
                <span className="text-sm font-medium">{ch}</span>
                <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => removeChannel(ch)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="@channel_name" value={newChannel} onChange={e => setNewChannel(e.target.value)} className="rounded-xl" />
              <Button className="rounded-xl" onClick={addChannel}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* === SETTINGS === */}
      {tab === 'settings' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Object.entries({ payment: '💳 Payment', bonus: '🎁 Bonus', store: '🏪 Store', bot: '🤖 Bot', security: '🔒 Security' }).map(([k, v]) => (
              <Button key={k} size="sm" variant={settingsCategory === k ? 'default' : 'outline'}
                className="rounded-xl text-xs whitespace-nowrap" onClick={() => setSettingsCategory(k)}>
                {v}
              </Button>
            ))}
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            {(SETTINGS_DEFS[settingsCategory] || []).map(s => (
              <div key={s.key} className="p-2.5 bg-muted/30 rounded-xl">
                {editingKey === s.key ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{s.emoji} {s.label}</p>
                    <Input value={editingValue} onChange={e => setEditingValue(e.target.value)} className="rounded-xl" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl" onClick={() => saveSetting(s.key, editingValue)}>Save</Button>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingKey('')}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => { setEditingKey(s.key); setEditingValue(settings[s.key] || ''); }}>
                    <div>
                      <p className="text-sm font-medium">{s.emoji} {s.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{settings[s.key] || '—'}</p>
                    </div>
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === BROADCAST === */}
      {tab === 'broadcast' && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Broadcast Message</h4>
          <p className="text-xs text-muted-foreground">বটের মাধ্যমে সব ইউজারকে মেসেজ পাঠাতে /broadcast কমান্ড ব্যবহার করুন।</p>
          <Textarea placeholder="Type your broadcast message..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={4} className="rounded-xl" />
          <Button className="w-full rounded-xl" onClick={handleBroadcast} disabled={broadcasting}>
            <Send className="w-4 h-4 mr-2" /> {broadcasting ? 'Sending...' : 'Preview Broadcast'}
          </Button>
        </div>
      )}

      {/* === OWNER === */}
      {tab === 'owner' && (
        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" /> Bot Admins</h4>
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <p className="text-sm font-medium">👑 <code>6898461453</code> — Super Admin (Owner)</p>
            </div>
            {admins.map(a => (
              <div key={a.telegram_id} className="flex items-center justify-between p-2 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground"><code>{a.telegram_id}</code></p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive rounded-lg" onClick={() => removeAdmin(a.telegram_id)}>
                  <UserMinus className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Telegram ID" value={newAdminId} onChange={e => setNewAdminId(e.target.value)} className="rounded-xl" />
              <Button className="rounded-xl" onClick={addAdmin}><UserPlus className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>👤 User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.first_name || '?'}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono text-xs">{selectedUser.telegram_id}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-bold text-green-600">₹{selectedUser.wallet?.balance || 0}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Reseller</p>
                  <p>{selectedUser.wallet?.is_reseller ? '✅ Yes' : '❌ No'}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p>{selectedUser.is_banned ? '🚫 Banned' : '✅ Active'}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-xl">
                  <p className="text-xs text-muted-foreground">Earned</p>
                  <p className="font-medium">₹{selectedUser.wallet?.total_earned || 0}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl" variant={selectedUser.is_banned ? 'default' : 'destructive'}
                  onClick={() => toggleBan(selectedUser.telegram_id, !selectedUser.is_banned)}>
                  {selectedUser.is_banned ? '✅ Unban' : '🚫 Ban'}
                </Button>
                <Button size="sm" className="flex-1 rounded-xl" variant="outline"
                  onClick={() => toggleReseller(selectedUser.telegram_id)}>
                  🔄 Toggle Reseller
                </Button>
              </div>

              {userHistory.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">📦 Orders ({userHistory.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {userHistory.map((o: any, i: number) => (
                      <div key={o.id} className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-lg text-xs">
                        <span>{o.status === 'confirmed' ? '✅' : o.status === 'rejected' ? '❌' : '⏳'}</span>
                        <span className="flex-1 truncate">{o.product_name}</span>
                        <span className="font-bold">₹{o.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTelegramBot;
