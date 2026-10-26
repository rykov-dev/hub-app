type Props = {
  label?: string;
};

/** Full-screen spinner for initial loading states. */
export const Loader = ({ label = 'Загрузка…' }: Props) => (
  <div className="loader" role="status">
    <span className="loader-spinner" aria-hidden />
    <span className="visually-hidden">{label}</span>
  </div>
);
