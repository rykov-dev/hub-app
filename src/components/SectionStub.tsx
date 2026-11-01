import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Placeholder for a hub section that isn't built yet. */
export const SectionStub = ({ title, description, children }: Props) => (
  <section className="card area-section stub">
    <div className="stub-header">
      <h2>{title}</h2>
      <span className="badge">Скоро</span>
    </div>
    <p className="muted">{description}</p>
    {children}
  </section>
);
