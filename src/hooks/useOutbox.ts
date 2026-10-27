import { useEffect, useSyncExternalStore } from 'react';
import { type OutboxItem, outbox } from '../lib/offline/outbox';

export const useOutbox = () => useSyncExternalStore(outbox.subscribe, outbox.getSnapshot);

/** Runs `listener` for every change the server accepts. */
export const useOutboxApplied = (listener: (item: OutboxItem) => void) => {
  useEffect(() => outbox.onApplied(listener), [listener]);
};
