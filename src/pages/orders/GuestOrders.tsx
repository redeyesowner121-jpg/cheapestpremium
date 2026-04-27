import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

const GuestOrders: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
          <motion.div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <ShoppingBag className="w-10 h-10 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">My Orders</h2>
          <p className="text-muted-foreground mb-8">Login to view your order history and track deliveries</p>
          <Button className="w-full h-12 btn-gradient rounded-xl" onClick={() => navigate('/auth')}>
            <LogIn className="w-5 h-5 mr-2" />Login to Continue
          </Button>
          <p className="text-sm text-muted-foreground mt-6">Guest orders can be tracked via email confirmation</p>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
};

export default GuestOrders;
