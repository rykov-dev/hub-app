import { NavLink } from 'react-router';
import { signOut } from '../lib/auth';
import { ThemeToggle } from './ThemeToggle';

const tabs = [
  { to: '/', label: 'Главная' },
  { to: '/inbox', label: 'Inbox' },
];

type Props = {
  userId: string;
  userName: string;
};

export const Topbar = ({ userId, userName }: Props) => (
  <header className="topbar">
    <strong className="topbar-brand">Deity</strong>
    <nav className="tabs" aria-label="Разделы">
      {tabs.map((tab) => (
        // Inbox stays lit on a note's page; Home only on itself.
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
          {tab.label}
        </NavLink>
      ))}
    </nav>
    <div className="topbar-user">
      <span className="muted">{userName}</span>
      <button type="button" className="link" onClick={() => signOut(userId)}>
        Выйти
      </button>
      <ThemeToggle />
    </div>
  </header>
);
