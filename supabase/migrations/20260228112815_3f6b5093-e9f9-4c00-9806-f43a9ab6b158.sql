
-- Knowledge base for AI learning from admin answers
CREATE TABLE public.telegram_ai_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  added_by BIGINT NOT NULL, -- admin telegram_id
  original_user_id BIGINT, -- user who asked
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_ai_knowledge ENABLE ROW LEVEL SECURITY;

-- Service role only (accessed via edge function)
CREATE POLICY "Service role only for ai_knowledge" 
ON public.telegram_ai_knowledge 
FOR ALL 
USING (false);

-- Index for search
CREATE INDEX idx_ai_knowledge_question ON public.telegram_ai_knowledge USING gin(to_tsvector('simple', question));
