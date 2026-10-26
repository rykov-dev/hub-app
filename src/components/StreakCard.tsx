type Props = {
  current: number;
  longest: number;
  className?: string;
};

export const StreakCard = ({ current, longest, className = '' }: Props) => (
  <section className={`card ${className}`}>
    <h2>Серия</h2>
    <div className="stats">
      <div>
        <span className="muted">Текущая</span>
        <strong>{current} дн.</strong>
      </div>
      <div>
        <span className="muted">Рекорд</span>
        <strong>{longest} дн.</strong>
      </div>
    </div>
  </section>
);
