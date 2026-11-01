/**
 * Chat settings. The chat talks to an OpenAI-compatible server; in dev that is the
 * local Bonsai model (`bun run bonsai`), reached through the dev server's /llm proxy.
 * Production builds have no model, so the chat page stays a placeholder there.
 */
export const chatConfig = {
  enabled: import.meta.env.DEV,
  /** Base URL of the OpenAI-compatible API. */
  baseUrl: '/llm/v1',
  /** Alias given to the model by scripts/bonsai.sh. */
  model: 'bonsai',
  systemPrompt:
    'Ты — ассистент в личном хабе пользователя: база знаний, заметки и идеи. ' +
    'Отвечай по-русски, коротко и по делу.',
  temperature: 0.7,
  maxTokens: 1024,
  /** Only the last messages go to the model, to stay within its context. */
  historyLimit: 20,
};
