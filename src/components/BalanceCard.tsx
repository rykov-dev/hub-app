import type { DailyClaimResult } from '../lib/api';

type Props = {
  coins: number;
  /** Result of today's visit claim, shown as a notice when coins were granted. */
  dailyClaim: DailyClaimResult | null;
  className?: string;
};

export const BalanceCard = ({ coins, dailyClaim, className = '' }: Props) => (
  <section className={`card ${className}`}>
    <h2>Баланс</h2>
    <div className="balance">
      <span className="coin" aria-hidden>
        ●
      </span>
      <strong>{coins}</strong>
    </div>
    {dailyClaim?.claimed && (
      <p className="toast">
        +{dailyClaim.reward} за визит
        {dailyClaim.streak_bonus > 0 && ` и +${dailyClaim.streak_bonus} за серию`}
      </p>
    )}
  </section>
);
