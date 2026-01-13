-- Create ranks table for configurable rank tiers
CREATE TABLE public.ranks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_balance NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  color TEXT DEFAULT 'text-gray-500',
  bg_color TEXT DEFAULT 'bg-gray-100',
  icon TEXT DEFAULT '🏅',
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'reseller', 'reseller_extra')),
  reseller_discount_percent NUMERIC DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

-- Public can read ranks
CREATE POLICY "Ranks are viewable by everyone" 
ON public.ranks 
FOR SELECT 
USING (true);

-- Only admins can manage ranks
CREATE POLICY "Admins can manage ranks" 
ON public.ranks 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'temp_admin')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ranks_updated_at
BEFORE UPDATE ON public.ranks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default ranks with new discount system
-- Heroic = Reseller price, Master = Reseller -0.5%, Grand Master = Reseller -0.7%, Titan = Reseller -1%
INSERT INTO public.ranks (name, min_balance, discount_percent, color, bg_color, icon, discount_type, reseller_discount_percent, sort_order) VALUES
('Bronze', 0, 0, 'text-amber-700', 'bg-amber-100', '🥉', 'percentage', 0, 1),
('Silver', 50, 0.5, 'text-slate-500', 'bg-slate-100', '🥈', 'percentage', 0, 2),
('Gold', 500, 1, 'text-yellow-600', 'bg-yellow-100', '🥇', 'percentage', 0, 3),
('Platinum', 2000, 2, 'text-cyan-600', 'bg-cyan-100', '💠', 'percentage', 0, 4),
('Diamond', 5000, 3, 'text-blue-500', 'bg-blue-100', '💎', 'percentage', 0, 5),
('Crystal', 10000, 5, 'text-purple-500', 'bg-purple-100', '🔮', 'percentage', 0, 6),
('Heroic', 25000, 0, 'text-red-500', 'bg-red-100', '⚔️', 'reseller', 0, 7),
('Master', 50000, 0, 'text-orange-500', 'bg-orange-100', '👑', 'reseller_extra', 0.5, 8),
('Grand Master', 75000, 0, 'text-pink-500', 'bg-pink-100', '🏆', 'reseller_extra', 0.7, 9),
('Titan', 100000, 0, 'text-indigo-600', 'bg-gradient-to-r from-indigo-100 to-purple-100', '⚡', 'reseller_extra', 1, 10);