import { BalanceCard } from '../components/BalanceCard';
import { HistoryCard } from '../components/HistoryCard';
import { SessionTimer } from '../components/SessionTimer';
import { StreakCard } from '../components/StreakCard';
import { useAppContext } from '../layouts/AppLayout';

export const DashboardPage = () => {
  const { profile, transactions, dailyClaim, activity } = useAppContext();

  return (
    <>
      <BalanceCard className="area-balance" coins={profile.coins} dailyClaim={dailyClaim} />
      <StreakCard
        className="area-streak"
        current={profile.current_streak}
        longest={profile.longest_streak}
      />
      <SessionTimer className="area-timer" activity={activity} />
      <HistoryCard className="area-history" transactions={transactions} />
    </>
  );
};
