import { useCallback } from 'react';
import { WorldFrame } from '../components/WorldFrame';
import { useOnline } from '../hooks/useOnline';
import { useAppContext } from '../layouts/AppLayout';
import { spendCoins } from '../lib/api';

// Where the world (project-25) is served from.
const WORLD_URL = import.meta.env.PUBLIC_WORLD_URL;

export const GamePage = () => {
  const { profile, refresh } = useAppContext();
  const online = useOnline();

  const onSpend = useCallback(
    async (amount: number, description: string, requestId: string) => {
      const coins = await spendCoins(amount, description, requestId);
      // Balance and history in the app come from the server.
      refresh();
      return coins;
    },
    [refresh],
  );

  if (!WORLD_URL) {
    return (
      <section className="card area-section">
        <h2>Игра</h2>
        <p className="muted">
          Игра не подключена: задай её адрес в переменной <code>PUBLIC_WORLD_URL</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="card area-section world">
      <div className="world-header">
        <h2>Игра</h2>
        <span className="muted">
          {online ? `${profile.coins} мон.` : 'Офлайн: тратить монетки нельзя'}
        </span>
      </div>
      <WorldFrame url={WORLD_URL} coins={profile.coins} canSpend={online} onSpend={onSpend} />
    </section>
  );
};
