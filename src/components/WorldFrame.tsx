import { useCallback, useEffect, useRef, useState } from 'react';
import { isNetworkError } from '../lib/offline/network';
import {
  type AppMessage,
  type SpendError,
  WORLD_PROTOCOL_VERSION,
  parseWorldMessage,
} from '../lib/world/protocol';

const toSpendError = (e: unknown): SpendError => {
  if (isNetworkError(e)) return 'offline';
  const message = (e as Error).message ?? '';
  if (message.includes('not_enough_coins')) return 'not_enough_coins';
  if (message.includes('invalid_amount')) return 'invalid_amount';
  return 'failed';
};

type Props = {
  url: string;
  coins: number;
  canSpend: boolean;
  /** Spends coins on the server; resolves to the new balance. */
  onSpend: (amount: number, description: string, requestId: string) => Promise<number>;
};

/**
 * The game world in an iframe with the coins API over postMessage: it gets the
 * balance and asks to spend coins. Messages from any other window or origin
 * are ignored.
 */
export const WorldFrame = ({ url, coins, canSpend, onSpend }: Props) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Bumped on every 'world:ready' (including reloads of the world) to resend the balance.
  const [readyCount, setReadyCount] = useState(0);
  const origin = new URL(url, window.location.href).origin;

  const post = useCallback(
    (message: AppMessage) => frameRef.current?.contentWindow?.postMessage(message, origin),
    [origin],
  );

  // Latest handler for the message listener, which is set up once.
  const onSpendRef = useRef(onSpend);
  onSpendRef.current = onSpend;

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      const message = parseWorldMessage(event.data);
      if (!message) return;

      if (message.type === 'world:ready') {
        setReadyCount((n) => n + 1);
        return;
      }

      const { requestId, amount, description } = message;
      try {
        const balance = await onSpendRef.current(amount, description, requestId);
        post({ type: 'monetki:result', requestId, ok: true, coins: balance });
      } catch (e) {
        post({ type: 'monetki:result', requestId, ok: false, error: toSpendError(e) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, post]);

  // The world always knows the current balance: on ready and after every change.
  useEffect(() => {
    if (readyCount === 0) return;
    post({ type: 'monetki:coins', version: WORLD_PROTOCOL_VERSION, coins, canSpend });
  }, [readyCount, coins, canSpend, post]);

  return (
    <iframe
      ref={frameRef}
      className="world-frame"
      src={url}
      title="Игровой мир"
      allow="fullscreen"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock"
    />
  );
};
