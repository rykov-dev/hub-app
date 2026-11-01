import { chatConfig } from './config';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Delta = { content?: string | null; reasoning_content?: string | null };

/** Whether the model server answers; the chat is shown only then. */
export const checkModel = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${chatConfig.baseUrl}/models`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Streams a reply from the OpenAI-compatible chat API (server-sent events).
 * Calls onText with each piece of the answer; reasoning tokens only signal onThinking.
 */
export const streamChat = async (
  messages: ChatMessage[],
  handlers: { onText: (text: string) => void; onThinking?: () => void },
  signal?: AbortSignal,
) => {
  const response = await fetch(`${chatConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: chatConfig.model,
      stream: true,
      temperature: chatConfig.temperature,
      max_tokens: chatConfig.maxTokens,
      messages: [
        { role: 'system', content: chatConfig.systemPrompt },
        ...messages.slice(-chatConfig.historyLimit),
      ],
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Модель недоступна (${response.status}). Запущен ли bun run bonsai?`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      const delta: Delta | undefined = JSON.parse(data).choices?.[0]?.delta;
      if (delta?.content) handlers.onText(delta.content);
      else if (delta?.reasoning_content) handlers.onThinking?.();
    }
  }
};
