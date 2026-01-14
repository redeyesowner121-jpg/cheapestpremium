import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, UserPlus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LoginRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string;
}

const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({ 
  open, 
  onOpenChange,
  action = 'continue'
}) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    onOpenChange(false);
    navigate('/auth', { state: { mode: 'login' } });
  };

  const handleSignup = () => {
    onOpenChange(false);
    navigate('/auth', { state: { mode: 'signup' } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl">
        <DialogHeader className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Lock className="w-8 h-8 text-primary" />
          </motion.div>
          <DialogTitle className="text-xl">Login Required</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Please login or create an account to {action}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            onClick={handleLogin}
            className="w-full h-12 btn-gradient rounded-xl text-base"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Login
          </Button>

          <Button
            variant="outline"
            onClick={handleSignup}
            className="w-full h-12 rounded-xl text-base"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create Account
          </Button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Continue browsing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginRequiredModal;
