import { BalanceCard } from '../components/BalanceCard';
import { HistoryCard } from '../components/HistoryCard';
import { KeyCard } from '../components/KeyCard';
import { StreakCard } from '../components/StreakCard';
import { useAppContext } from '../layouts/AppLayout';

export const DashboardPage = () => {
  const { profile, transactions, dailyClaim, vaultKey, account } = useAppContext();

  return (
    <>
      <BalanceCard className="area-balance" coins={profile.coins} dailyClaim={dailyClaim} />
      <StreakCard
        className="area-streak"
        current={profile.current_streak}
        longest={profile.longest_streak}
      />
      <KeyCard className="area-key" vaultKey={vaultKey} account={account} />
      <HistoryCard className="area-history" transactions={transactions} />
    </>
  );
};
