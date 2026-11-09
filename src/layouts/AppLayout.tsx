import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Outlet, useOutletContext, useSearchParams } from 'react-router';
import { InboxButton } from '../components/InboxButton';
import { InboxNoteDialog } from '../components/InboxNoteDialog';
import { Loader } from '../components/Loader';
import { Topbar } from '../components/Topbar';
import { useDayStart } from '../hooks/useDayStart';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { useRewards } from '../hooks/useRewards';
import type { Profile } from '../lib/api';
import { outbox } from '../lib/offline/outbox';
import { type SharedItem, takeSharedItem } from '../lib/share';

type RewardsState = ReturnType<typeof useRewards>;

export type AppContext = Omit<RewardsState, 'profile'> & {
  profile: Profile;
  /** Today's local date, 'YYYY-MM-DD'; changes at midnight once the app is looked at. */
  day: string;
};

/** Typed access to the layout's context from pages. */
export const useAppContext = () => useOutletContext<AppContext>();

/**
 * Shell for signed-in pages: top bar, the Inbox button and dialog. Also picks
 * up content shared to the app (Android share sheet) and marks the day start.
 */
export const AppLayout = ({ user }: { user: User }) => {
  const rewards = useRewards(user.id);
  const online = useOnline();
  const { items, error: syncError } = useOutbox();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [shared, setShared] = useState<SharedItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const shareParam = searchParams.get('share');

  useEffect(() => {
    outbox.load(user.id);
    return () => outbox.unload();
  }, [user.id]);

  // After outbox.load above, so the day start is queued for this user.
  const day = useDayStart(user.id);

  // The service worker keeps shared content until the app takes it, so a
  // share made while signed out is picked up after signing in.
  useEffect(() => {
    let cancelled = false;
    takeSharedItem().then((item) => {
      // A remount gets the same item; only the live effect shows it.
      if (cancelled) return;
      if (item) {
        setShared(item);
        setInboxOpen(true);
      } else if (shareParam === 'failed') {
        setNotice('Не удалось принять то, чем поделились');
      }
    });
    if (shareParam) {
      setSearchParams(
        (params) => {
          params.delete('share');
          return params;
        },
        { replace: true },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [shareParam, setSearchParams]);

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

  const context: AppContext = { ...rewards, profile, day };

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
        userId={user.id}
        shared={shared}
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
