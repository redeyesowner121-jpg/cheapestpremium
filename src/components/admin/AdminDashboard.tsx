import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, ShoppingBag, Clock, TrendingUp, Award, Calendar, 
  Package, UserPlus, Bell, MessageCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import AdminAnalytics from '@/components/AdminAnalytics';
import AdminSearchAnalytics from '@/components/AdminSearchAnalytics';
import { AdminStats, AdminData } from '@/hooks/useAdminData';

interface AdminDashboardProps {
  stats: AdminStats;
  data: AdminData;
  isAdmin: boolean;
  onShowAnnouncementModal: () => void;
  onShowTempAdminModal: () => void;
  onTabChange: (tab: string) => void;
  onRemoveTempAdmin: (userId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  stats,
  data,
  isAdmin,
  onShowAnnouncementModal,
  onShowTempAdminModal,
  onTabChange,
  onRemoveTempAdmin
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Compact Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Users, value: stats.totalUsers, label: 'Users', color: 'primary' },
          { icon: TrendingUp, value: `₹${stats.totalDeposits.toFixed(0)}`, label: 'Deposits', color: 'success' },
          { icon: ShoppingBag, value: stats.totalOrders, label: 'Orders', color: 'accent' },
          { icon: Clock, value: stats.pendingOrders, label: 'Pending', color: 'secondary', highlight: stats.pendingOrders > 0 }
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-card rounded-2xl p-3 shadow-card text-center relative overflow-hidden ${
              stat.highlight ? 'ring-2 ring-primary/50' : ''
            }`}
          >
            {stat.highlight && (
              <motion.div
                className="absolute inset-0 bg-primary/5"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <stat.icon className={`w-5 h-5 text-${stat.color} mx-auto mb-1`} />
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>
      
      {/* Mini Stats Row */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { icon: Award, value: stats.blueTickUsers, label: 'Blue Tick' },
          { icon: Calendar, value: stats.todayOrders, label: 'Today' },
          { icon: Package, value: data.products.length, label: 'Products' },
          { icon: UserPlus, value: data.tempAdmins.length, label: 'Temp Admins' }
        ].map((stat) => (
          <div 
            key={stat.label}
            className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 min-w-fit"
          >
            <stat.icon className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Stock Alert */}
      {(stats.lowStockProducts.length > 0 || stats.outOfStockProducts.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3"
        >
          <Bell className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1 flex flex-wrap gap-2">
            {stats.outOfStockProducts.length > 0 && (
              <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-lg">
                {stats.outOfStockProducts.length} Out of Stock
              </span>
            )}
            {stats.lowStockProducts.length > 0 && (
              <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded-lg">
                {stats.lowStockProducts.length} Low Stock
              </span>
            )}
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-xs"
            onClick={() => onTabChange('products')}
          >
            View
          </Button>
        </motion.div>
      )}

      {/* Analytics */}
      <AdminAnalytics orders={data.orders} products={data.products} />
      <AdminSearchAnalytics />
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
          onClick={onShowAnnouncementModal}
        >
          <Bell className="w-6 h-6 text-primary" />
          <span className="text-xs">Announcement</span>
        </Button>
        
        {isAdmin && (
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
            onClick={onShowTempAdminModal}
          >
            <UserPlus className="w-6 h-6 text-secondary" />
            <span className="text-xs">Add Temp Admin</span>
          </Button>
        )}

        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
          onClick={() => onTabChange('orders')}
        >
          <ShoppingBag className="w-6 h-6 text-accent" />
          <span className="text-xs">Manage Orders</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl"
          onClick={() => navigate('/chat')}
        >
          <MessageCircle className="w-6 h-6 text-success" />
          <span className="text-xs">Messages</span>
        </Button>
      </div>

      {/* Temp Admins List */}
      {isAdmin && data.tempAdmins.length > 0 && (
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3">Temporary Admins</h3>
          <div className="space-y-2">
            {data.tempAdmins.map((ta: any) => (
              <div key={ta.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">{ta.profiles?.name || ta.profiles?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires: {new Date(ta.temp_admin_expiry).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onRemoveTempAdmin(ta.user_id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Recent Orders</h3>
          <button onClick={() => onTabChange('orders')} className="text-sm text-primary">
            View All
          </button>
        </div>
        <div className="space-y-2">
          {data.orders.slice(0, 5).map((order: any) => (
            <div key={order.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <img src={order.product_image || 'https://via.placeholder.com/50'} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{order.product_name}</p>
                <p className="text-xs text-muted-foreground">{order.profiles?.name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">₹{order.total_price}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  order.status === 'completed' ? 'bg-success/10 text-success' :
                  order.status === 'pending' ? 'bg-primary/10 text-primary' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
