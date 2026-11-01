import { NavLink } from 'react-router';
import { signOut } from '../lib/auth';
import { sections } from '../lib/sections';
import { ThemeToggle } from './ThemeToggle';

// Inbox follows the knowledge base it collects notes for.
const tabs = [
  { to: '/', label: 'Главная' },
  ...sections.flatMap((section) =>
    section.to === '/knowledge' ? [section, { to: '/inbox', label: 'Inbox' }] : [section],
  ),
];

type Props = {
  userId: string;
  userName: string;
};

export const Topbar = ({ userId, userName }: Props) => (
  <header className="topbar">
    <strong className="topbar-brand">Монетки</strong>
    <nav className="tabs" aria-label="Разделы">
      {tabs.map((tab) => (
        // Sections stay lit on their nested pages (a note, a chat); Home only on itself.
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
