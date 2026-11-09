const URL_PATTERN = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]}'])/gi;

type Props = {
  text: string;
  className?: string;
};

/** Text with its http(s) links clickable; they open in a new tab. */
export const LinkifiedText = ({ text, className }: Props) => (
  <p className={className}>
    {text.split(URL_PATTERN).map((part, i) =>
      // split() with a capture group puts the matches at odd indexes.
      i % 2 === 1 ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-link">
          {part}
        </a>
      ) : (
        part
      ),
    )}
  </p>
);
