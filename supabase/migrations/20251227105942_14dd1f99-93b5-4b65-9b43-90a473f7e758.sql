-- Create search_logs table for tracking user searches
CREATE TABLE public.search_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    search_term text NOT NULL,
    results_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own search logs
CREATE POLICY "Users can insert search logs"
ON public.search_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins can view all search logs
CREATE POLICY "Admins can view all search logs"
ON public.search_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_search_logs_term ON public.search_logs(search_term);
CREATE INDEX idx_search_logs_created ON public.search_logs(created_at DESC);