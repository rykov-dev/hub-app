import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';

export const Topbar = ({ userName }: { userName: string }) => (
  <header className="topbar">
    <strong>Монетки</strong>
    <div className="topbar-user">
      <span className="muted">{userName}</span>
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Выйти
      </button>
      <ThemeToggle />
    </div>
  </header>
);
