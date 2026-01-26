import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface ProfileMenuItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number;
  color: string;
  bgColor: string;
  onClick?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: () => void;
  index: number;
  isClaimable?: boolean;
}

const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({
  icon,
  label,
  value,
  color,
  bgColor,
  onClick,
  toggle,
  toggleValue,
  onToggle,
  index,
  isClaimable,
}) => {
  return (
    <motion.button
      onClick={toggle ? undefined : onClick}
      className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-4 card-hover"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.03 }}
      whileTap={!toggle ? { scale: 0.98 } : undefined}
    >
      <div className={`p-2 rounded-xl ${bgColor}`}>
        <div className={color}>{icon}</div>
      </div>
      <span className="flex-1 text-left font-medium text-foreground">{label}</span>
      {toggle ? (
        <Switch checked={toggleValue} onCheckedChange={onToggle} />
      ) : (
        <>
          {value !== undefined && (
            <span className={`text-sm ${isClaimable ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
              {value}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </>
      )}
    </motion.button>
  );
};

export default ProfileMenuItem;
