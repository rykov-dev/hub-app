import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router';
import { InboxButton } from '../components/InboxButton';
import { InboxNoteDialog } from '../components/InboxNoteDialog';
import { Loader } from '../components/Loader';
import { Topbar } from '../components/Topbar';
import { useRewards } from '../hooks/useRewards';
import type { Profile } from '../lib/api';

type RewardsState = ReturnType<typeof useRewards>;

export type AppContext = Omit<RewardsState, 'profile'> & {
  profile: Profile;
  /** Bumped after a note is added, so pages showing notes can reload. */
  notesVersion: number;
};

/** Typed access to the layout's context from pages. */
export const useAppContext = () => useOutletContext<AppContext>();

/**
 * Shell for signed-in pages: top bar with tabs, the Inbox button and dialog.
 * Rewards live here rather than in a page so that switching tabs doesn't stop
 * heartbeats and break the continuous time-on-site session.
 */
export const AppLayout = ({ user }: { user: User }) => {
  const rewards = useRewards(user.id);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [notesVersion, setNotesVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const { profile, error, refresh } = rewards;

  if (!profile) {
    return error ? (
      <div className="layout">
        <p className="error">{error}</p>
      </div>
    ) : (
      <Loader />
    );
  }

  const context: AppContext = { ...rewards, profile, notesVersion };

  return (
    <div className="layout layout-with-inbox">
      <Topbar userName={profile.display_name ?? user.email ?? ''} />
      <Outlet context={context} />
      {error && <p className="error">{error}</p>}

      <InboxButton onClick={() => setInboxOpen(true)} />
      <InboxNoteDialog
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onSaved={(reward) => {
          setNotice(`Сохранено в Inbox · +${reward} мон.`);
          setNotesVersion((v) => v + 1);
          refresh();
        }}
      />
      {notice && (
        <p className="snackbar" role="status">
          {notice}
        </p>
      )}
    </div>
  );
};
