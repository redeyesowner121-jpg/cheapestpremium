import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Gift, Package, TrendingUp, Megaphone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

const notifications = [
  { id: '1', type: 'announcement', title: 'Flash Sale Live!', message: 'Up to 70% off on all OTT subscriptions', time: '2h ago', icon: Megaphone },
  { id: '2', type: 'order', title: 'Order Completed', message: 'Your Netflix Premium order is ready', time: '5h ago', icon: Package },
  { id: '3', type: 'bonus', title: 'Daily Bonus', message: 'Claim your ₹0.50 daily bonus now!', time: '1d ago', icon: Gift },
  { id: '4', type: 'deposit', title: 'Deposit Successful', message: '₹500 added to your wallet', time: '2d ago', icon: TrendingUp },
];

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="glass fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold">Notifications</h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        <div className="space-y-3">
          {notifications.map((notif, index) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-2xl p-4 shadow-card flex items-start gap-4"
            >
              <div className="p-2 rounded-xl gradient-primary">
                <notif.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{notif.title}</h3>
                <p className="text-sm text-muted-foreground">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default NotificationsPage;
