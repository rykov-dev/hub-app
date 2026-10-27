import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { readStoredSession } from '../lib/auth';
import { isNetworkError } from '../lib/offline/network';
import { supabase } from '../lib/supabase';

/** Current auth session; `undefined` while it is still loading. Works offline. */
export const useSession = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      const offline = error && isNetworkError(error);
      setSession(data.session ?? (offline ? readStoredSession() : null));
    });
    // Offline, a null session here is a failed token refresh rather than a
    // sign-out; supabase-js refreshes it once the connection is back.
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (s || event === 'SIGNED_OUT') setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
};
