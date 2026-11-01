import { useCallback, useEffect, useState } from 'react';
import { checkModel } from '../lib/chat/client';
import { chatConfig } from '../lib/chat/config';

const RETRY_MS = 10_000;

/**
 * Whether the chat model can be reached: undefined while checking. While it
 * can't, the check repeats, so starting the model brings the chat back by itself.
 */
export const useModelAvailable = () => {
  const [available, setAvailable] = useState<boolean | undefined>(
    chatConfig.enabled ? undefined : false,
  );

  const recheck = useCallback(async () => {
    if (chatConfig.enabled) setAvailable(await checkModel());
  }, []);

  useEffect(() => {
    recheck();
  }, [recheck]);

  useEffect(() => {
    if (available !== false || !chatConfig.enabled) return;
    const id = setInterval(recheck, RETRY_MS);
    window.addEventListener('focus', recheck);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', recheck);
    };
  }, [available, recheck]);

  return { available, recheck };
};
