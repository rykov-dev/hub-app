import { Link } from 'react-router';
import { BalanceCard } from '../components/BalanceCard';
import { HistoryCard } from '../components/HistoryCard';
import { StreakCard } from '../components/StreakCard';
import { useAppContext } from '../layouts/AppLayout';

export const DashboardPage = () => {
  const { profile, transactions, dailyClaim } = useAppContext();

  return (
    <>
      <Link to="/" className="link back-link">
        ← Сегодня
      </Link>
      <BalanceCard className="area-balance" coins={profile.coins} dailyClaim={dailyClaim} />
      <StreakCard
        className="area-streak"
        current={profile.current_streak}
        longest={profile.longest_streak}
      />
      <HistoryCard className="area-history" transactions={transactions} />
    </>
  );
};
