import React, { useState, useEffect } from 'react';
import { Bot, Users, Wallet, Radio, Settings, Megaphone, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import BotOverviewTab from './telegram-bot/BotOverviewTab';
import BotUsersTab from './telegram-bot/BotUsersTab';
import BotWalletTab from './telegram-bot/BotWalletTab';
import BotChannelsTab from './telegram-bot/BotChannelsTab';
import BotSettingsTab from './telegram-bot/BotSettingsTab';
import BotBroadcastTab from './telegram-bot/BotBroadcastTab';
import BotOwnerTab from './telegram-bot/BotOwnerTab';
import BotUserModal from './telegram-bot/BotUserModal';

type Tab = 'overview' | 'users' | 'wallet' | 'channels' | 'settings' | 'broadcast' | 'owner';

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

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Bot },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
  { key: 'channels', label: 'Channels', icon: Radio },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'broadcast', label: 'Broadcast', icon: Megaphone },
  { key: 'owner', label: 'Owner', icon: Crown },
];

const AdminTelegramBot: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [walletTgId, setWalletTgId] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsCategory, setSettingsCategory] = useState('payment');
  const [editingKey, setEditingKey] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminId, setNewAdminId] = useState('');

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
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [todayOrdersRes, todayRevenueRes] = await Promise.all([
        supabase.from('telegram_orders' as any).select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('telegram_orders' as any).select('amount').eq('status', 'confirmed').gte('created_at', today.toISOString()),
      ]);
      const todayRevenue = ((todayRevenueRes.data as any[]) || []).reduce((s: number, o: any) => s + (o.amount || 0), 0);
      const { data: allConfirmed } = await supabase.from('telegram_orders' as any).select('amount').eq('status', 'confirmed');
      const allRevenue = ((allConfirmed as any[]) || []).reduce((s: number, o: any) => s + (o.amount || 0), 0);
      setStats({
        totalUsers: (usersRes as any).count || 0, totalOrders: (ordersRes as any).count || 0,
        pendingOrders: (pendingRes as any).count || 0, confirmedOrders: (confirmedRes as any).count || 0,
        totalWallets: (walletsRes as any).count || 0, totalResellers: (resellersRes as any).count || 0,
        totalBalance, todayOrders: (todayOrdersRes as any).count || 0, todayRevenue, allRevenue,
      });
    } catch { toast.error('Failed to load stats'); }
    setLoading(false);
  };

  const fetchUsers = async (page = 0, search = '') => {
    let query = supabase.from('telegram_bot_users' as any)
      .select('telegram_id, username, first_name, last_name, is_banned, last_active, created_at', { count: 'exact' })
      .order('last_active', { ascending: false }).range(page * 20, (page + 1) * 20 - 1);
    if (search) query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,telegram_id.eq.${parseInt(search) || 0}`);
    const { data, count } = await query;
    setUsers((data as any[]) || []); setUsersTotal(count || 0); setUsersPage(page);
  };

  const fetchUserDetail = async (tgId: number) => {
    const [walletRes, ordersRes, userRes] = await Promise.all([
      supabase.from('telegram_wallets' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
      supabase.from('telegram_orders' as any).select('*').eq('telegram_user_id', tgId).order('created_at', { ascending: false }).limit(20),
      supabase.from('telegram_bot_users' as any).select('*').eq('telegram_id', tgId).maybeSingle(),
    ]);
    setSelectedUser({ ...((userRes.data as any) || {}), wallet: (walletRes.data as any) });
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
    const tgId = parseInt(walletTgId); const amount = parseFloat(walletAmount);
    if (!tgId || !amount || amount <= 0) { toast.error('Enter valid TG ID and amount'); return; }
    const { data: wallet } = await supabase.from('telegram_wallets' as any).select('balance').eq('telegram_id', tgId).maybeSingle();
    if (!wallet && action === 'deduct') { toast.error('User has no wallet'); return; }
    const currentBal = (wallet as any)?.balance || 0;
    if (action === 'deduct' && currentBal < amount) { toast.error(`Insufficient balance: ₹${currentBal}`); return; }
    const newBal = action === 'add' ? currentBal + amount : currentBal - amount;
    await supabase.from('telegram_wallets' as any).update({ balance: newBal, updated_at: new Date().toISOString() } as any).eq('telegram_id', tgId);
    await supabase.from('telegram_wallet_transactions' as any).insert({ telegram_id: tgId, amount: action === 'add' ? amount : -amount, type: action === 'add' ? 'admin_credit' : 'admin_deduction', description: `Admin ${action === 'add' ? 'added' : 'deducted'} ₹${amount}` } as any);
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
    setChannels(updated); setNewChannel(''); toast.success(`✅ ${ch} added`);
  };

  const removeChannel = async (ch: string) => {
    const updated = channels.filter(c => c !== ch);
    await supabase.from('app_settings').upsert({ key: 'required_channels', value: JSON.stringify(updated), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setChannels(updated); toast.success(`✅ ${ch} removed`);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    const map: Record<string, string> = {};
    (data || []).forEach((s: any) => { map[s.key] = s.value || ''; });
    setSettings(map);
  };

  const saveSetting = async (key: string, value: string) => {
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSettings(prev => ({ ...prev, [key]: value })); setEditingKey(''); toast.success('✅ Setting saved');
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
    toast.success(`✅ Admin ${tgId} added`); setNewAdminId(''); fetchAdmins();
  };

  const removeAdmin = async (tgId: number) => {
    if (tgId === 6898461453) { toast.error('Cannot remove super admin'); return; }
    await supabase.from('telegram_bot_admins' as any).delete().eq('telegram_id', tgId);
    toast.success(`✅ Admin ${tgId} removed`); fetchAdmins();
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) { toast.error('Enter a message'); return; }
    setBroadcasting(true);
    const { data: allUsers } = await supabase.from('telegram_bot_users' as any).select('telegram_id').eq('is_banned', false);
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

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'ghost'}
            className="rounded-xl gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {tab === 'overview' && <BotOverviewTab stats={stats} loading={loading} onRefresh={fetchStats} />}
      {tab === 'users' && <BotUsersTab users={users} usersPage={usersPage} usersTotal={usersTotal} userSearch={userSearch} setUserSearch={setUserSearch} fetchUsers={fetchUsers} fetchUserDetail={fetchUserDetail} toggleBan={toggleBan} />}
      {tab === 'wallet' && <BotWalletTab walletTgId={walletTgId} setWalletTgId={setWalletTgId} walletAmount={walletAmount} setWalletAmount={setWalletAmount} onWalletAction={handleWalletAction} />}
      {tab === 'channels' && <BotChannelsTab channels={channels} newChannel={newChannel} setNewChannel={setNewChannel} onAdd={addChannel} onRemove={removeChannel} />}
      {tab === 'settings' && <BotSettingsTab settings={settings} settingsCategory={settingsCategory} setSettingsCategory={setSettingsCategory} editingKey={editingKey} editingValue={editingValue} setEditingKey={setEditingKey} setEditingValue={setEditingValue} onSave={saveSetting} settingsDefs={SETTINGS_DEFS} />}
      {tab === 'broadcast' && <BotBroadcastTab broadcastMsg={broadcastMsg} setBroadcastMsg={setBroadcastMsg} broadcasting={broadcasting} onBroadcast={handleBroadcast} />}
      {tab === 'owner' && <BotOwnerTab admins={admins} newAdminId={newAdminId} setNewAdminId={setNewAdminId} onAddAdmin={addAdmin} onRemoveAdmin={removeAdmin} />}

      <BotUserModal open={showUserModal} onOpenChange={setShowUserModal} selectedUser={selectedUser} userHistory={userHistory} onToggleBan={toggleBan} onToggleReseller={toggleReseller} />
    </div>
  );
};

export default AdminTelegramBot;
