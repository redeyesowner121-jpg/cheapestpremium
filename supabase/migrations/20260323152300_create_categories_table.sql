/*
  # Create Categories Table
  
  1. New Tables
    - `categories` - Product categories with icons and order
    
  2. Security
    - Enable RLS on categories table
    - Add policy for public read access
    - Admin-only write access
    
  3. Initial Data
    - OTT Platforms (Netflix, Prime, etc.)
    - Music Streaming (Spotify, etc.)
    - Tools & Software (ChatGPT, Canva, etc.)
    - Gaming (Steam, etc.)
    - VPN Services
    - Education
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  slug text UNIQUE NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public can read categories
CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

-- Only admins can modify categories
CREATE POLICY "Only admins can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Only admins can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Only admins can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'temp_admin')
    )
  );

-- Insert default categories
INSERT INTO public.categories (name, icon, slug, sort_order) VALUES
  ('OTT Platforms', '📺', 'ott', 1),
  ('Music Streaming', '🎵', 'music', 2),
  ('Tools & Software', '🛠️', 'tools', 3),
  ('Gaming', '🎮', 'gaming', 4),
  ('VPN Services', '🔐', 'vpn', 5),
  ('Education', '📚', 'education', 6)
ON CONFLICT (slug) DO NOTHING;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);
