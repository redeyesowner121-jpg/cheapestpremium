import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import appLogo from '@/assets/app-logo.jpg';

const GuestProfile: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
          <motion.img src={appLogo} alt="RKR Premium"
            className="w-24 h-24 rounded-2xl mx-auto mb-6 shadow-lg"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }} />
          <h2 className="text-2xl font-bold text-foreground mb-2">Welcome!</h2>
          <p className="text-muted-foreground mb-8">Login to access your profile, wallet, orders and more</p>
          <div className="space-y-3">
            <Button className="w-full h-12 btn-gradient rounded-xl" onClick={() => navigate('/auth')}>
              <LogIn className="w-5 h-5 mr-2" />Login
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => navigate('/auth')}>
              <UserPlus className="w-5 h-5 mr-2" />Create Account
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-8">You can browse products without logging in</p>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
};

export default GuestProfile;
