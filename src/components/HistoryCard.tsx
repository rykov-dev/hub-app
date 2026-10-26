import type { CoinTransaction } from '../lib/api';

const reasonLabels: Record<CoinTransaction['reason'], string> = {
  daily_visit: 'Ежедневный визит',
  streak_bonus: 'Бонус за серию',
  time_on_site: '15 минут на сайте',
};

type Props = {
  transactions: CoinTransaction[];
  className?: string;
};

export const HistoryCard = ({ transactions, className = '' }: Props) => (
  <section className={`card ${className}`}>
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
);
