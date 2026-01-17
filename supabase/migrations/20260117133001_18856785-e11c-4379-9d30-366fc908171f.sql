-- Add sender_name column to manual_deposit_requests for user to provide their name
ALTER TABLE public.manual_deposit_requests 
ADD COLUMN sender_name TEXT;