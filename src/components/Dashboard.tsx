import type { User } from '@supabase/supabase-js';
import { useRewards } from '../hooks/useRewards';
import type { CoinTransaction } from '../lib/api';
import { supabase } from '../lib/supabase';
import { SessionTimer } from './SessionTimer';

const reasonLabels: Record<CoinTransaction['reason'], string> = {
  daily_visit: 'Ежедневный визит',
  streak_bonus: 'Бонус за серию',
  time_on_site: '15 минут на сайте',
};

export const Dashboard = ({ user }: { user: User }) => {
  const { profile, transactions, dailyClaim, activity, error } = useRewards(user.id);

  if (!profile) {
    return <main className="card">{error ? <p className="error">{error}</p> : 'Загрузка…'}</main>;
  }

  return (
    <main className="card">
      <header className="header">
        <span>{profile.display_name ?? user.email}</span>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
          Выйти
        </button>
      </header>

      <div className="balance">
        <span className="coin" aria-hidden>
          ●
        </span>
        <strong>{profile.coins}</strong>
      </div>

      {dailyClaim?.claimed && (
        <p className="toast">
          +{dailyClaim.reward} за визит
          {dailyClaim.streak_bonus > 0 && ` и +${dailyClaim.streak_bonus} за серию`}
        </p>
      )}

      <section className="stats">
        <div>
          <span className="muted">Серия</span>
          <strong>{profile.current_streak} дн.</strong>
        </div>
        <div>
          <span className="muted">Рекорд</span>
          <strong>{profile.longest_streak} дн.</strong>
        </div>
      </section>

      <SessionTimer activity={activity} />

      <section>
        <h2>История</h2>
        <ul className="history">
          {transactions.map((t) => (
            <li key={t.id}>
              <span>{reasonLabels[t.reason]}</span>
              <span className="muted">{t.day}</span>
              <strong>+{t.amount}</strong>
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
};
