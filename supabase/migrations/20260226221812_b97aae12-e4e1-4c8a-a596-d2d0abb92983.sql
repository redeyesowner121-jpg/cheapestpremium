
-- Store AI conversation history per telegram user
CREATE TABLE public.telegram_ai_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id bigint NOT NULL,
  role text NOT NULL, -- 'user' or 'assistant'
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_ai_messages_user ON public.telegram_ai_messages(telegram_id, created_at DESC);

ALTER TABLE public.telegram_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for telegram_ai_messages"
ON public.telegram_ai_messages FOR ALL USING (false);
