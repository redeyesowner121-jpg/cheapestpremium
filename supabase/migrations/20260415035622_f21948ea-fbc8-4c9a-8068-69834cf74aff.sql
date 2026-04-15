ALTER TABLE public.products 
ADD COLUMN show_link_in_bot boolean NOT NULL DEFAULT true,
ADD COLUMN show_link_in_website boolean NOT NULL DEFAULT true;