import {
  deleteLegacyNotes,
  fetchLegacyComments,
  fetchLegacyNotes,
} from '../api';
import { outbox } from '../offline/outbox';
import { deleteStored, readStoredByPrefix } from '../offline/storage';
import { commentPath, notePath } from './model';
import { listRemote } from './remote';
import { vault } from './vault';

/**
 * Moves data from before the vault into it: plain-text notes and comments in
 * the database, and changes to them still queued on this device. Database
 * rows are deleted only once their encrypted copies are on the server; until
 * then this runs again on the next start.
 */

type LegacyOutboxItem = { id: string; at: number } & (
  | { kind: 'addNote'; note: { id: string; body: string; tags: string[]; created_at: string } }
  | { kind: 'setTags'; noteId: string; tags: string[] }
  | { kind: 'addComment'; noteId: string; comment: { id: string; body: string; created_at: string } }
);

const legacyOutboxPrefix = (userId: string) => `${userId}:outbox:`;

const drained = () =>
  new Promise<void>((resolve) => {
    if (outbox.getSnapshot().items.length === 0) return resolve();
    const stop = outbox.onDrained(() => {
      stop();
      resolve();
    });
  });

let running: Promise<void> | null = null;

/** Runs at most once at a time; a call while it runs waits for that run. */
export const migrateLegacy = (userId: string) => {
  running ??= migrate(userId).finally(() => {
    running = null;
  });
  return running;
};

const migrate = async (userId: string) => {
  const [notes, comments] = await Promise.all([fetchLegacyNotes(), fetchLegacyComments()]);
  const queued = (await readStoredByPrefix<LegacyOutboxItem>(legacyOutboxPrefix(userId))).sort(
    (a, b) => a.at - b.at,
  );
  if (notes.length === 0 && queued.length === 0) return;

  const writes: Promise<void>[] = [];
  for (const note of notes) {
    if (!vault.has(notePath(note.id))) writes.push(vault.addNote(note.body, note));
  }
  for (const c of comments) {
    if (!vault.has(commentPath(c.note_id, c.id))) {
      writes.push(vault.addComment(c.note_id, c.body, { id: c.id, created_at: c.created_at }));
    }
  }
  await Promise.all(writes);

  // Changes made before the update that never reached the database.
  for (const item of queued) {
    if (item.kind === 'addNote' && !vault.has(notePath(item.note.id))) {
      await vault.addNote(item.note.body, item.note);
    } else if (item.kind === 'setTags') {
      await vault.setTags(item.noteId, item.tags);
    } else if (item.kind === 'addComment' && !vault.has(commentPath(item.noteId, item.comment.id))) {
      await vault.addComment(item.noteId, item.comment.body, item.comment);
    }
    await deleteStored(legacyOutboxPrefix(userId) + item.id);
  }

  if (notes.length === 0) return;
  await drained();
  const onServer = new Set((await listRemote(userId)).map((o) => o.path));
  const moved = notes.filter(
    (n) =>
      onServer.has(notePath(n.id)) &&
      comments.every((c) => c.note_id !== n.id || onServer.has(commentPath(n.id, c.id))),
  );
  await deleteLegacyNotes(moved.map((n) => n.id));
};
