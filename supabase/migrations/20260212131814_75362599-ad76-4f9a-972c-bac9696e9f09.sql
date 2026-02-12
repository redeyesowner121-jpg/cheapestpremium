
-- Add unique constraint on app_settings.key so upsert works correctly
-- First remove any duplicate keys (keep the latest one)
DELETE FROM public.app_settings a
USING public.app_settings b
WHERE a.id < b.id AND a.key = b.key;

-- Now add unique constraint
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_unique UNIQUE (key);
