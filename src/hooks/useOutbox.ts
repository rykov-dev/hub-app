import { useSyncExternalStore } from 'react';
import { outbox } from '../lib/offline/outbox';

export const useOutbox = () => useSyncExternalStore(outbox.subscribe, outbox.getSnapshot);
