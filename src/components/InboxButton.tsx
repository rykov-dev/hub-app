type Props = {
  onClick: () => void;
};

/** Floating Inbox button: a bottom bar on phones, a corner button on larger screens. */
export const InboxButton = ({ onClick }: Props) => (
  <button type="button" className="btn btn-primary inbox-button" onClick={onClick}>
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z" />
    </svg>
    Inbox
  </button>
);
