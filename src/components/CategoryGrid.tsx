import React, { useMemo } from 'react';
import { 
  Tv, Music, GamepadIcon, Cloud, BookOpen, Briefcase,
  Gift, Coins, Lightbulb, GraduationCap, Wrench, LucideIcon
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  icon_url: string | null;
}

const categoryIcons: Record<string, { icon: LucideIcon; gradient: string }> = {
  'ott': { icon: Tv, gradient: 'from-red-500 to-pink-500' },
  'music': { icon: Music, gradient: 'from-emerald-500 to-teal-500' },
  'gaming': { icon: GamepadIcon, gradient: 'from-violet-500 to-purple-500' },
  'games': { icon: GamepadIcon, gradient: 'from-violet-500 to-purple-500' },
  'cloud': { icon: Cloud, gradient: 'from-sky-500 to-blue-500' },
  'education': { icon: BookOpen, gradient: 'from-amber-500 to-orange-500' },
  'tools': { icon: Wrench, gradient: 'from-slate-500 to-gray-600' },
  'free': { icon: Gift, gradient: 'from-pink-500 to-rose-500' },
  'earning': { icon: Coins, gradient: 'from-emerald-500 to-green-500' },
  'methods': { icon: Lightbulb, gradient: 'from-orange-500 to-red-500' },
  'courses': { icon: GraduationCap, gradient: 'from-indigo-500 to-violet-500' },
};

const defaultIcon = { icon: Briefcase, gradient: 'from-gray-500 to-gray-600' };

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
        icon: <IconComponent className="w-7 h-7 text-white" />,
        gradient: iconData.gradient,
      };
    });
  }, [categories]);

  if (loading) {
    return (
      <div className="w-full">
        <h2 className="text-lg font-bold text-foreground mb-4 font-display">Categories</h2>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-muted" />
              <div className="w-12 h-3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-bold text-foreground mb-4 font-display">Categories</h2>
      
      <div className="grid grid-cols-4 gap-3">
        {categoryItems.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryClick?.(category.name)}
            className="relative flex flex-col items-center justify-center rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 active:scale-95 overflow-hidden w-full h-[84px]"
          >
            {category.icon_url ? (
              <>
                <img
                  src={category.icon_url}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl" />
                <span className="relative z-10 mt-auto mb-2 px-1.5 text-[10px] font-bold text-white drop-shadow-lg leading-tight">
                  {category.name}
                </span>
              </>
            ) : (
              <>
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${category.gradient} shadow-lg`}>
                  {category.icon}
                </div>
                <span className="text-[11px] font-semibold text-foreground mt-1.5">{category.name}</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(CategoryGrid);
