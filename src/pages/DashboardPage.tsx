import type { User } from '@supabase/supabase-js';
import { BalanceCard } from '../components/BalanceCard';
import { HistoryCard } from '../components/HistoryCard';
import { Loader } from '../components/Loader';
import { SessionTimer } from '../components/SessionTimer';
import { StreakCard } from '../components/StreakCard';
import { Topbar } from '../components/Topbar';
import { useRewards } from '../hooks/useRewards';

export const DashboardPage = ({ user }: { user: User }) => {
  const { profile, transactions, dailyClaim, activity, error } = useRewards(user.id);

  if (!profile) {
    return error ? (
      <div className="layout">
        <p className="error">{error}</p>
      </div>
    ) : (
      <Loader />
    );
  }

  return (
    <div className="layout">
      <Topbar userName={profile.display_name ?? user.email ?? ''} />
      <BalanceCard className="area-balance" coins={profile.coins} dailyClaim={dailyClaim} />
      <StreakCard
        className="area-streak"
        current={profile.current_streak}
        longest={profile.longest_streak}
      />
      <SessionTimer className="area-timer" activity={activity} />
      <HistoryCard className="area-history" transactions={transactions} />
      {error && <p className="error">{error}</p>}
    </div>
  );
};
