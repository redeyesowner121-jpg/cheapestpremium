-- Add seo_tags column to products table for better search
ALTER TABLE public.products ADD COLUMN seo_tags text DEFAULT '';
