
CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_user_id ON public.ai_chat_messages(user_id, created_at DESC);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI chat messages"
  ON public.ai_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI chat messages"
  ON public.ai_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI chat messages"
  ON public.ai_chat_messages FOR DELETE
  USING (auth.uid() = user_id);
