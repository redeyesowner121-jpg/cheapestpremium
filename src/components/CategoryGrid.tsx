import React, { useMemo } from 'react';
import { 
  Tv, 
  Music, 
  GamepadIcon, 
  Cloud, 
  BookOpen, 
  Briefcase,
  Gift,
  Coins,
  Lightbulb,
  GraduationCap,
  Wrench,
  LucideIcon
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  icon_url: string | null;
}

// Icon mapping for categories
const categoryIcons: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
  'ott': { icon: Tv, color: 'text-red-500', bgColor: 'bg-red-100' },
  'music': { icon: Music, color: 'text-green-500', bgColor: 'bg-green-100' },
  'gaming': { icon: GamepadIcon, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  'games': { icon: GamepadIcon, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  'cloud': { icon: Cloud, color: 'text-blue-500', bgColor: 'bg-blue-100' },
  'education': { icon: BookOpen, color: 'text-amber-500', bgColor: 'bg-amber-100' },
  'tools': { icon: Wrench, color: 'text-slate-500', bgColor: 'bg-slate-100' },
  'free': { icon: Gift, color: 'text-pink-500', bgColor: 'bg-pink-100' },
  'earning': { icon: Coins, color: 'text-emerald-500', bgColor: 'bg-emerald-100' },
  'methods': { icon: Lightbulb, color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'courses': { icon: GraduationCap, color: 'text-indigo-500', bgColor: 'bg-indigo-100' },
};

// Default icon for unknown categories
const defaultIcon = { icon: Briefcase, color: 'text-gray-500', bgColor: 'bg-gray-100' };

interface CategoryGridProps {
  categories?: Category[];
  onCategoryClick?: (categoryId: string) => void;
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ categories: propCategories, onCategoryClick }) => {
  const categories = propCategories || [];
  const loading = categories.length === 0;

  const categoryItems = useMemo(() => {
    return categories.map(cat => {
      const key = cat.name.toLowerCase();
      const iconData = categoryIcons[key] || defaultIcon;
      const IconComponent = iconData.icon;
      
      return {
        id: cat.id,
        name: cat.name,
        icon_url: cat.icon_url,
        icon: <IconComponent className="w-10 h-10" />,
        color: iconData.color,
        bgColor: iconData.bgColor,
      };
    });
  }, [categories]);

  if (loading) {
    return (
      <div className="w-full">
        <h2 className="text-lg font-bold text-foreground mb-4">Categories</h2>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-muted" />
              <div className="w-12 h-3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-bold text-foreground mb-4">Categories</h2>
      
      <div className="grid grid-cols-4 gap-3">
        {categoryItems.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick?.(category.name)}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card shadow-card hover:shadow-lg transition-shadow active:scale-95"
          >
            <div className={`p-3 rounded-xl ${category.icon_url ? '' : category.bgColor}`}>
              {category.icon_url ? (
                <img src={category.icon_url} alt={category.name} className="w-10 h-10 object-contain rounded" />
              ) : (
                <div className={category.color}>{category.icon}</div>
              )}
            </div>
            <span className="text-xs font-medium text-foreground">{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CategoryGrid);
