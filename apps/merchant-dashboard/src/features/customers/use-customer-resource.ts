import { useEffect, useState } from 'react';
import { apiRequestSingle } from '../../lib/api-client.js';

/** Abort obsolete reads; never retain customer contact data in browser storage. */
export function useCustomerResource<T>(path: string | null, refresh = 0) {
  const key = `${path}:${refresh}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void apiRequestSingle<T>(path, { signal: controller.signal }).then(
        (data) => {
          if (!controller.signal.aborted) setResult({ key, data });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setResult({ key, error });
        },
      );
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, refresh, key]);
  const current = result?.key === key ? result : undefined;
  return { data: current?.data, error: current?.error, loading: Boolean(path) && !current };
}
