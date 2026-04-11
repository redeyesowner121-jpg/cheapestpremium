-- Add status column to telegram_ai_knowledge for approval workflow
ALTER TABLE public.telegram_ai_knowledge 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Set all existing entries as approved
UPDATE public.telegram_ai_knowledge SET status = 'approved' WHERE status = 'pending';

-- Change default for new entries to 'pending'
ALTER TABLE public.telegram_ai_knowledge ALTER COLUMN status SET DEFAULT 'pending';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_status ON public.telegram_ai_knowledge(status);