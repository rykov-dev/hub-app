import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router';
import { InboxButton } from '../components/InboxButton';
import { InboxNoteDialog } from '../components/InboxNoteDialog';
import { Loader } from '../components/Loader';
import { Topbar } from '../components/Topbar';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { useRewards } from '../hooks/useRewards';
import type { Profile } from '../lib/api';
import { outbox } from '../lib/offline/outbox';

type RewardsState = ReturnType<typeof useRewards>;

export type AppContext = Omit<RewardsState, 'profile'> & { profile: Profile };

/** Typed access to the layout's context from pages. */
export const useAppContext = () => useOutletContext<AppContext>();

/**
 * Shell for signed-in pages: top bar with tabs, the Inbox button and dialog.
 * Rewards live here rather than in a page so that switching tabs doesn't stop
 * heartbeats and break the continuous time-on-site session.
 */
export const AppLayout = ({ user }: { user: User }) => {
  const rewards = useRewards(user.id);
  const online = useOnline();
  const { items, error: syncError } = useOutbox();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    outbox.load(user.id);
    return () => outbox.unload();
  }, [user.id]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const { profile, profileLoading, error } = rewards;

  if (!profile) {
    if (profileLoading) return <Loader />;
    return (
      <div className="layout">
        <p className={error ? 'error' : 'muted'}>
          {error ?? 'Нет сети, а данных на этом устройстве ещё нет. Подключись, чтобы начать.'}
        </p>
      </div>
    );
  }

  const context: AppContext = { ...rewards, profile };

  return (
    <div className="layout layout-with-inbox">
      <Topbar userId={user.id} userName={profile.display_name ?? user.email ?? ''} />
      {(!online || items.length > 0) && (
        <p className="sync-status muted small" role="status">
          {online
            ? `Синхронизация… (${items.length})`
            : `Офлайн${items.length > 0 ? ` · ждут синхронизации: ${items.length}` : ''}`}
        </p>
      )}
      {syncError && (
        <p className="error">
          {syncError}{' '}
          <button type="button" className="link" onClick={outbox.dismissError}>
            Скрыть
          </button>
        </p>
      )}
      <Outlet context={context} />
      {error && <p className="error">{error}</p>}

      <InboxButton onClick={() => setInboxOpen(true)} />
      <InboxNoteDialog
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onSaved={() =>
          setNotice(online ? 'Сохранено в Inbox' : 'Сохранено офлайн, отправится при появлении сети')
        }
      />
      {notice && (
        <p className="snackbar" role="status">
          {notice}
        </p>
      )}
    </div>
  );
};
