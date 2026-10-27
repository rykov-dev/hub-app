type Props = {
  tags: string[];
  /** When set, each tag gets a remove button. */
  onRemove?: (tag: string) => void;
};

export const TagList = ({ tags, onRemove }: Props) =>
  tags.length === 0 ? null : (
    <ul className="tags">
      {tags.map((tag) => (
        <li key={tag} className="tag">
          #{tag}
          {onRemove && (
            <button
              type="button"
              className="tag-remove"
              aria-label={`Убрать тег ${tag}`}
              onClick={() => onRemove(tag)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
