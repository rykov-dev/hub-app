import { Link } from 'react-router';
import { sections } from '../lib/sections';

type Props = {
  className?: string;
};

/** Entry points to the hub's sections on the home page. */
export const SectionTiles = ({ className = '' }: Props) => (
  <nav className={`section-tiles ${className}`} aria-label="Разделы хаба">
    {sections.map((section) => (
      <Link key={section.to} to={section.to} className="card section-tile">
        <strong>{section.label}</strong>
        <span className="muted">{section.description}</span>
      </Link>
    ))}
  </nav>
);
