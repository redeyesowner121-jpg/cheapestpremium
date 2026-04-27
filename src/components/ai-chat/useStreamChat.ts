import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Msg, CHAT_URL } from './types';
import { generateFollowUps, splitWebMessage } from './chatHelpers';

interface StreamOptions {
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  setLoading: (b: boolean) => void;
  setFollowUps: (s: string[]) => void;
  saveToDb: (msg: Msg) => Promise<string | undefined>;
}

export function useStreamChat(opts: StreamOptions) {
  const { setMessages, setLoading, setFollowUps, saveToDb } = opts;
  const abortRef = useRef<AbortController | null>(null);
  const streamStartTime = useRef<number>(0);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    setLoading(true);
    setFollowUps([]);
    abortRef.current = new AbortController();
    streamStartTime.current = Date.now();
    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({
            role: m.role,
            content: m.image_url ? `[User sent an image: ${m.image_url}]\n${m.content}` : m.content,
          })),
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        toast.error(errData.error || 'AI is temporarily unavailable');
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const processLine = (line: string) => {
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') return false;
        if (!line.startsWith('data: ')) return false;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') { streamDone = true; return false; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            const wc = assistantSoFar.split(/\s+/).filter(Boolean).length;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && !last.id) {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar, wordCount: wc } : m);
              }
              return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now(), wordCount: wc }];
            });
          }
          return true;
        } catch { return false; }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          const line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (!processLine(line)) {
            try { JSON.parse(line.slice(6).trim()); } catch {
              if (line.startsWith('data: ')) { textBuffer = line + '\n' + textBuffer; break; }
            }
          }
        }
      }
      if (textBuffer.trim()) {
        for (const raw of textBuffer.split('\n')) if (raw) processLine(raw);
      }

      const responseTime = Date.now() - streamStartTime.current;
      const parts = splitWebMessage(assistantSoFar.trim());

      if (parts.length > 1) {
        const splitMsgs: Msg[] = parts.map((part, idx) => ({
          role: 'assistant' as const, content: part, timestamp: Date.now() + idx,
          wordCount: part.split(/\s+/).filter(Boolean).length,
          responseTime: idx === parts.length - 1 ? responseTime : undefined,
        }));
        const savedIds: (string | undefined)[] = [];
        for (const msg of splitMsgs) savedIds.push(await saveToDb(msg));
        setMessages(prev => {
          const withoutStreaming = prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && !m.id));
          return [...withoutStreaming, ...splitMsgs.map((m, i) => ({ ...m, id: savedIds[i] }))];
        });
      } else {
        const assistantMsg: Msg = {
          role: 'assistant', content: assistantSoFar, timestamp: Date.now(),
          wordCount: assistantSoFar.split(/\s+/).filter(Boolean).length, responseTime,
        };
        const savedId = await saveToDb(assistantMsg);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, id: savedId, responseTime } : m);
          }
          return prev;
        });
      }
      setFollowUps(generateFollowUps(assistantSoFar));
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error('Failed to connect to AI');
    }
    setLoading(false);
  }, [setMessages, setLoading, setFollowUps, saveToDb]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, [setLoading]);

  return { streamChat, handleStop };
}
