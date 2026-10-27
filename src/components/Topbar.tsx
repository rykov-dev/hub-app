import { NavLink } from 'react-router';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';

const tabs = [
  { to: '/', label: 'Главная' },
  { to: '/inbox', label: 'Inbox' },
];

export const Topbar = ({ userName }: { userName: string }) => (
  <header className="topbar">
    <strong className="topbar-brand">Монетки</strong>
    <nav className="tabs" aria-label="Разделы">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className="tab">
          {tab.label}
        </NavLink>
      ))}
    </nav>
    <div className="topbar-user">
      <span className="muted">{userName}</span>
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Выйти
      </button>
      <ThemeToggle />
    </div>
  </header>
);
