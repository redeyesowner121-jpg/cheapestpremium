import React from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, UserPlus, ShoppingBag, MessageCircle, Settings, 
  Image, Zap, CreditCard, Users, Package, Shield,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AdminData } from '@/hooks/useAdminData';

interface AdminControlTabProps {
  data: AdminData;
  isAdmin: boolean;
  onShowAnnouncementModal: () => void;
  onShowTempAdminModal: () => void;
  onTabChange: (tab: string) => void;
  onRemoveTempAdmin: (userId: string) => void;
}

const AdminControlTab: React.FC<AdminControlTabProps> = ({
  data,
  isAdmin,
  onShowAnnouncementModal,
  onShowTempAdminModal,
  onTabChange,
  onRemoveTempAdmin
}) => {
  const navigate = useNavigate();

  const quickActions = [
    { icon: Bell, label: 'Send Announcement', description: 'Notify all users', onClick: onShowAnnouncementModal, color: 'primary' },
    { icon: ShoppingBag, label: 'Manage Orders', description: `${data.orders.filter(o => o.status === 'pending').length} pending`, onClick: () => onTabChange('orders'), color: 'accent' },
    { icon: Users, label: 'User Management', description: `${data.users.length} users`, onClick: () => onTabChange('users'), color: 'blue-500' },
    { icon: Package, label: 'Products', description: `${data.products.length} items`, onClick: () => onTabChange('products'), color: 'purple-500' },
    { icon: MessageCircle, label: 'Messages', description: 'Customer support', onClick: () => navigate('/chat'), color: 'success' },
    { icon: Image, label: 'Content Manager', description: 'Banners & Flash sales', onClick: () => onTabChange('content'), color: 'orange-500' },
    { icon: CreditCard, label: 'Payment Settings', description: 'Configure payments', onClick: () => onTabChange('payments'), color: 'emerald-500' },
    ...(isAdmin ? [{ icon: Settings, label: 'App Settings', description: 'System configuration', onClick: () => onTabChange('settings'), color: 'slate-500' }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Control Center</h2>
          <p className="text-sm text-muted-foreground">Manage your store and settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">{isAdmin ? 'Full Access' : 'Limited Access'}</span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={action.onClick}
            className="bg-card hover:bg-muted/50 rounded-2xl p-4 text-left transition-all hover:shadow-lg group border border-border/50 hover:border-border"
          >
            <div className={`p-2 bg-${action.color}/10 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform`}>
              <action.icon className={`w-5 h-5 text-${action.color}`} />
            </div>
            <h4 className="font-semibold text-foreground text-sm mb-0.5">{action.label}</h4>
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          </motion.button>
        ))}
      </div>

      {/* Temp Admin Management */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-xl">
                <UserPlus className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Temporary Admins</h3>
                <p className="text-xs text-muted-foreground">{data.tempAdmins.length} active</p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={onShowTempAdminModal}
              className="rounded-xl"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
          
          {data.tempAdmins.length > 0 ? (
            <div className="divide-y divide-border">
              {data.tempAdmins.map((ta: any) => (
                <div key={ta.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                      <span className="text-lg">{(ta.profiles?.name || 'U')[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{ta.profiles?.name || ta.profiles?.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(ta.temp_admin_expiry).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    onClick={() => onRemoveTempAdmin(ta.user_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No temporary admins</p>
              <p className="text-xs mt-1">Add someone to help manage your store</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Recent Orders Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Recent Orders</h3>
              <p className="text-xs text-muted-foreground">Latest 5 orders</p>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => onTabChange('orders')}
            className="rounded-xl"
          >
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        
        <div className="divide-y divide-border">
          {data.orders.slice(0, 5).map((order: any) => (
            <div key={order.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
              <img 
                src={order.product_image || 'https://via.placeholder.com/50'} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover" 
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{order.product_name}</p>
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
      </motion.div>
    </div>
  );
};

export default AdminControlTab;
