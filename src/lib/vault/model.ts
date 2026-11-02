/** What the vault holds. Each note and each comment is its own encrypted object. */

export type Note = {
  id: string;
  body: string;
  tags: string[];
  created_at: string;
};

export type NoteComment = {
  id: string;
  noteId: string;
  body: string;
  created_at: string;
};

// Paths inside the user's folder. Comments are separate objects rather than
// part of their note, so comments written on two devices never overwrite
// each other; the note id leads their name so a note's comments are easy to find.
export const NOTES_DIR = 'notes';
export const COMMENTS_DIR = 'comments';

export const notePath = (id: string) => `${NOTES_DIR}/${id}.bin`;
export const commentPath = (noteId: string, id: string) => `${COMMENTS_DIR}/${noteId}.${id}.bin`;

export const isNotePath = (path: string) => path.startsWith(`${NOTES_DIR}/`);
export const isCommentOf = (path: string, noteId: string) =>
  path.startsWith(`${COMMENTS_DIR}/${noteId}.`);
