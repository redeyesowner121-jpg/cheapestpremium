import React from 'react';
import { motion } from 'framer-motion';
import { 
  Tv, 
  Music, 
  GamepadIcon, 
  Cloud, 
  BookOpen, 
  Briefcase,
  Gift,
  Coins
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const categories: Category[] = [
  { id: 'ott', name: 'OTT', icon: <Tv className="w-6 h-6" />, color: 'text-red-500', bgColor: 'bg-red-100' },
  { id: 'music', name: 'Music', icon: <Music className="w-6 h-6" />, color: 'text-green-500', bgColor: 'bg-green-100' },
  { id: 'gaming', name: 'Gaming', icon: <GamepadIcon className="w-6 h-6" />, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  { id: 'cloud', name: 'Cloud', icon: <Cloud className="w-6 h-6" />, color: 'text-blue-500', bgColor: 'bg-blue-100' },
  { id: 'education', name: 'Education', icon: <BookOpen className="w-6 h-6" />, color: 'text-amber-500', bgColor: 'bg-amber-100' },
  { id: 'tools', name: 'Tools', icon: <Briefcase className="w-6 h-6" />, color: 'text-slate-500', bgColor: 'bg-slate-100' },
  { id: 'free', name: 'Free', icon: <Gift className="w-6 h-6" />, color: 'text-pink-500', bgColor: 'bg-pink-100' },
  { id: 'earning', name: 'Earning', icon: <Coins className="w-6 h-6" />, color: 'text-emerald-500', bgColor: 'bg-emerald-100' },
];

interface CategoryGridProps {
  onCategoryClick?: (categoryId: string) => void;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ onCategoryClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <h2 className="text-lg font-bold text-foreground mb-4">Categories</h2>
      
      <div className="grid grid-cols-4 gap-3">
        {categories.map((category, index) => (
          <motion.button
            key={category.id}
            onClick={() => onCategoryClick?.(category.id)}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card shadow-card card-hover"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`p-3 rounded-xl ${category.bgColor}`}>
              <div className={category.color}>{category.icon}</div>
            </div>
            <span className="text-xs font-medium text-foreground">{category.name}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default CategoryGrid;
