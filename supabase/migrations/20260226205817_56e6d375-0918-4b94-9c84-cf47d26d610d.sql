
-- Create table to persist telegram bot conversation state
CREATE TABLE public.telegram_conversation_state (
  telegram_id BIGINT PRIMARY KEY,
  step TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_conversation_state ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can access
CREATE POLICY "Service role only for conversation state"
  ON public.telegram_conversation_state
  FOR ALL
  USING (false);
