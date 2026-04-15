// ===== AI HELPER: SSE Stream Parser =====

export async function* parseSSEStream(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
}

// Split long text into separate Telegram messages
export function splitMessage(text: string): string[] {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  
  if (paragraphs.length >= 2) {
    const parts: string[] = [];
    for (const para of paragraphs) {
      if (para.length > 500) {
        const lines = para.split(/\n/).map(l => l.trim()).filter(Boolean);
        let currentChunk = "";
        for (const line of lines) {
          if (currentChunk && (currentChunk + "\n" + line).length > 400) {
            parts.push(currentChunk);
            currentChunk = line;
          } else {
            currentChunk = currentChunk ? currentChunk + "\n" + line : line;
          }
        }
        if (currentChunk) parts.push(currentChunk);
      } else {
        parts.push(para);
      }
    }
    return parts;
  }
  
  const productPattern = /\n(?=📦|🔥|➡️|•\s|[-]\s|\d+[\.\)]\s)/;
  const productSplit = text.split(productPattern).map(p => p.trim()).filter(Boolean);
  if (productSplit.length >= 2) return productSplit;
  
  if (text.length > 400) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length >= 3) {
      const parts: string[] = [];
      let chunk = "";
      for (const line of lines) {
        if (chunk && (chunk + "\n" + line).length > 300) {
          parts.push(chunk);
          chunk = line;
        } else {
          chunk = chunk ? chunk + "\n" + line : line;
        }
      }
      if (chunk) parts.push(chunk);
      if (parts.length >= 2) return parts;
    }
  }
  
  return [text];
}
