type Props = {
  label?: string;
  /** Inside a page instead of filling the screen. */
  inline?: boolean;
};

/** Spinner for loading states. */
export const Loader = ({ label = 'Загрузка…', inline = false }: Props) => (
  <div className={inline ? 'loader loader-inline' : 'loader'} role="status">
    <span className="loader-spinner" aria-hidden />
    <span className="visually-hidden">{label}</span>
  </div>
);
