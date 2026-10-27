export const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/**
 * Normalizes user input into a tag the database accepts: no leading '#',
 * lowercase, trimmed, inner whitespace as '-'. Returns null for empty input.
 */
export const normalizeTag = (input: string): string | null => {
  const tag = input
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, MAX_TAG_LENGTH);
  return tag || null;
};
