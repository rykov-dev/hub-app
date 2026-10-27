import { type KeyboardEvent, useState } from 'react';
import { MAX_TAGS, normalizeTag } from '../lib/tags';
import { TagList } from './TagList';

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

/** Tags with remove buttons and an input that adds a tag on Enter or comma. */
export const TagEditor = ({ tags, onChange }: Props) => {
  const [input, setInput] = useState('');

  const add = () => {
    const tag = normalizeTag(input);
    setInput('');
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) onChange([...tags, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tag-editor">
      <TagList tags={tags} onRemove={(tag) => onChange(tags.filter((t) => t !== tag))} />
      {tags.length < MAX_TAGS && (
        <input
          className="input tag-input"
          placeholder="Добавить тег"
          aria-label="Добавить тег"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      )}
    </div>
  );
};
