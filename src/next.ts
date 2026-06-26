'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDeepLink, init, isReady, type DeepLinkResponse, type InitConfig } from './index';

export interface UseProDeepLinkOptions extends InitConfig {
  /** Run getDeepLink automatically after init (default: true) */
  autoResolve?: boolean;
}

export interface UseProDeepLinkResult {
  loading: boolean;
  initialized: boolean;
  result: DeepLinkResponse | null;
  resolve: () => Promise<DeepLinkResponse>;
}

/**
 * Next.js / React hook for deferred deep link resolution.
 *
 * Import from `web-prodeeplinks/next` in client components only.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { useProDeepLink } from 'web-prodeeplinks/next';
 *
 * export function DeepLinkHandler() {
 *   const { loading, result } = useProDeepLink({
 *     apiKey: process.env.NEXT_PUBLIC_PRODEEPLINKS_KEY!,
 *   });
 *
 *   if (loading) return null;
 *   if (result?.url) window.location.href = result.url;
 *   return null;
 * }
 * ```
 */
export function useProDeepLink(options: UseProDeepLinkOptions): UseProDeepLinkResult {
  const { autoResolve = true, ...initConfig } = options;
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [result, setResult] = useState<DeepLinkResponse | null>(null);

  const resolve = useCallback(async (): Promise<DeepLinkResponse> => {
    const response = await getDeepLink();
    setResult(response);
    return response;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);

      if (!isReady()) {
        const initResult = await init(initConfig);
        if (cancelled) return;

        if (!initResult.success) {
          setResult({ success: false, error: initResult.error });
          setInitialized(false);
          setLoading(false);
          return;
        }
      }

      setInitialized(true);

      if (autoResolve) {
        const response = await getDeepLink();
        if (!cancelled) {
          setResult(response);
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [autoResolve, initConfig.apiKey, initConfig.licenseKey, initConfig.appVersion, initConfig.apiBaseUrl]);

  return {
    loading,
    initialized,
    result,
    resolve,
  };
}
