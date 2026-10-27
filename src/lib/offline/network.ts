/**
 * True for failures caused by having no connection rather than by the server
 * rejecting the request: those are worth retrying later, the rest are not.
 */
export const isNetworkError = (e: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const err = e as { name?: string; message?: string } | null;
  return (
    err?.name === 'TypeError' ||
    err?.name === 'FunctionsFetchError' ||
    err?.name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(err?.message ?? '')
  );
};
