import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Timer, Volume2, VolumeX, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminHeaderProps {
  isTempAdmin: boolean;
  tempAdminExpiry?: string;
  alertsEnabled: boolean;
  onToggleAlerts: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ isTempAdmin, tempAdminExpiry, alertsEnabled, onToggleAlerts }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-gradient-to-r from-primary/10 via-background to-accent/10 sticky top-0 z-50 px-4 py-3 border-b border-border/50 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <motion.button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Admin Dashboard
          </h1>
          {isTempAdmin && tempAdminExpiry && (
            <p className="text-xs text-accent flex items-center gap-1">
              <Timer className="w-3 h-3" />
              Expires: {new Date(tempAdminExpiry).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="icon"
              variant={alertsEnabled ? "default" : "outline"}
              onClick={onToggleAlerts}
              title={alertsEnabled ? "Alerts ON" : "Alerts OFF"}
              className="rounded-xl"
            >
              {alertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="sm" variant="outline" onClick={() => navigate('/chat')} className="rounded-xl">
              <MessageCircle className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
