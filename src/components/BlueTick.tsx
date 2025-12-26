import React from 'react';
import blueTick from '@/assets/blue-tick.png';

interface BlueTickProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const BlueTick: React.FC<BlueTickProps> = ({ size = 'md', className = '' }) => {
  return (
    <img 
      src={blueTick} 
      alt="Verified" 
      className={`${sizeClasses[size]} inline-block ${className}`}
      title="Verified User"
    />
  );
};

export default BlueTick;
