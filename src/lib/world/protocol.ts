// Coins API for the game world in its iframe (window.postMessage). The world
// keeps its own content and prices; the app only tells it the balance and
// spends coins on its request. Described for the world's side in
// docs/world-iframe-api.md.

export const WORLD_PROTOCOL_VERSION = 1;

export type SpendError = 'not_enough_coins' | 'invalid_amount' | 'offline' | 'failed';

/** App → world. */
export type AppMessage =
  | {
      type: 'monetki:coins';
      version: typeof WORLD_PROTOCOL_VERSION;
      coins: number;
      /** False offline: spending needs the server. */
      canSpend: boolean;
    }
  | { type: 'monetki:result'; requestId: string; ok: true; coins: number }
  | { type: 'monetki:result'; requestId: string; ok: false; error: SpendError };

/** World → app. */
export type WorldMessage =
  | { type: 'world:ready'; version: number }
  | { type: 'world:spend'; requestId: string; amount: number; description: string };

const isString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

/** Validates a message from the world; anything malformed is ignored. */
export const parseWorldMessage = (data: unknown): WorldMessage | null => {
  const m = data as Record<string, unknown> | null;
  if (!m || typeof m !== 'object') return null;
  switch (m.type) {
    case 'world:ready':
      return Number.isInteger(m.version) ? { type: 'world:ready', version: m.version as number } : null;
    case 'world:spend':
      return isString(m.requestId, 100) &&
        Number.isInteger(m.amount) &&
        (m.amount as number) > 0 &&
        isString(m.description, 200)
        ? {
            type: 'world:spend',
            requestId: m.requestId,
            amount: m.amount as number,
            description: m.description,
          }
        : null;
    default:
      return null;
  }
};
