import {
  InitConfig,
  InitResponse,
  DeepLinkResponse,
  CustomDeepLinkAnalyticsEvent,
  MmpConversionPayload,
  TrackPurchasePayload,
} from './types';
import { parseDeepLinkParams, parsePageAttributionParams } from './deeplinkParams';
import { buildEventPayload, mapLegacyEventType } from './eventPayload';
import {
  enqueueMmpEvent,
  fetchAttributionWithRetry,
  flushMmpEvents,
  matchFingerprint,
  postConversion,
  postMmpEvent,
} from './api';
import {
  buildFingerprintMatchPayload,
  generateBrowserFingerprint,
  getInitialUrlFromPage,
  isBrowserEnvironment,
} from './fingerprint';
import { resolveApiKey, validateApiKeyFormat } from './license';
import {
  clearAttributionParams,
  getApiKey,
  getAppVersion,
  getAttributionParams,
  getCachedFingerprint,
  getCustomerUserId,
  getIsInitialized,
  getResolvedDeepLinkUrl,
  getSessionId,
  hasSentOrderId,
  markOrderIdSent,
  mergeAttributionParams,
  resetRuntimeState,
  setApiKey,
  setAppVersion,
  setBaseUrl,
  setCachedFingerprint,
  setCustomerUserIdValue,
  setIsInitialized,
  setResolvedDeepLinkUrl,
  setSessionId,
} from './runtime';

function requireInitialized(): { ok: true; apiKey: string } | { ok: false; error: string } {
  const apiKey = getApiKey();
  if (!getIsInitialized() || !apiKey) {
    return { ok: false, error: 'Please call init() first with your API key' };
  }
  return { ok: true, apiKey };
}

function storeDeepLinkUrl(url: string): void {
  mergeAttributionParams(parseDeepLinkParams(url));
  setResolvedDeepLinkUrl(url);
}

function applySessionFromResponse(sessionId?: string): void {
  if (sessionId) {
    setSessionId(sessionId);
  }
}

async function runDeferredFingerprintMatch(): Promise<void> {
  if (getResolvedDeepLinkUrl()) {
    return;
  }

  const fingerprint = getCachedFingerprint();
  if (!fingerprint) {
    return;
  }

  const match = await matchFingerprint(
    buildFingerprintMatchPayload(fingerprint, getCustomerUserId())
  );

  if (!match.matched) {
    return;
  }

  if (match.url) {
    setResolvedDeepLinkUrl(match.url);
  }

  if (match.clickId || match.pdlSessionId) {
    mergeAttributionParams({
      clickId: match.clickId,
      pdlSessionId: match.pdlSessionId,
    });
  }
}

/**
 * Initialize the SDK with your publishable API key.
 * Parses page attribution params on launch and runs deferred fingerprint match in parallel.
 * App launch `app_open` events are handled by the backend layer — not sent from this SDK.
 */
export async function init(config: InitConfig): Promise<InitResponse> {
  try {
    const apiKey = resolveApiKey(config);
    const validation = validateApiKeyFormat(apiKey);
    if (!validation.isValid) {
      return { success: false, error: validation.message || 'Invalid API key' };
    }

    if (config.apiBaseUrl) {
      setBaseUrl(config.apiBaseUrl);
    }

    setAppVersion(config.appVersion || 'web');
    setApiKey(apiKey);
    setIsInitialized(true);

    if (isBrowserEnvironment()) {
      const fingerprint = generateBrowserFingerprint(getAppVersion());
      setCachedFingerprint(fingerprint);

      mergeAttributionParams(parsePageAttributionParams());

      const initialUrl = getInitialUrlFromPage();
      if (initialUrl) {
        storeDeepLinkUrl(initialUrl);
      }

      runDeferredFingerprintMatch().catch(() => {});
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to initialize' };
  }
}

/**
 * Set the active MMP session ID returned by the backend app_open layer.
 */
export function updateSessionId(sessionId: string | null | undefined): void {
  setSessionId(sessionId);
}

/**
 * Set your internal user id after login/signup.
 * Automatically sends a login event to link anonymous activity.
 */
export async function setCustomerUserId(
  customerUserId: string | null | undefined
): Promise<{ success: boolean; error?: string }> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }

  const userId = customerUserId ? String(customerUserId) : null;
  setCustomerUserIdValue(userId);

  if (!userId) {
    return { success: true };
  }

  const fingerprint = getCachedFingerprint();
  if (!fingerprint) {
    return { success: false, error: 'Browser fingerprint not ready' };
  }

  const loginEvent = buildEventPayload(fingerprint, {
    eventType: 'login',
    sessionId: getSessionId(),
    userId,
    attribution: getAttributionParams(),
  });

  const response = await postMmpEvent(ready.apiKey, loginEvent);
  applySessionFromResponse(response.sessionId);

  return { success: response.success, error: response.error };
}

/**
 * Resolve deep link URL: page URL first, then deferred fingerprint match result.
 */
export async function getDeepLink(
  callback?: (url: string) => void
): Promise<DeepLinkResponse> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }

  if (!isBrowserEnvironment()) {
    return {
      success: false,
      error: 'getDeepLink() must be called in the browser',
    };
  }

  try {
    const cached = getResolvedDeepLinkUrl();
    if (cached) {
      callback?.(cached);
      return { success: true, url: cached };
    }

    const initialUrl = getInitialUrlFromPage();
    if (initialUrl) {
      storeDeepLinkUrl(initialUrl);
      callback?.(initialUrl);
      return { success: true, url: initialUrl };
    }

    const fingerprint = getCachedFingerprint();
    if (!fingerprint) {
      return { success: false, error: 'Browser fingerprint not ready' };
    }

    const match = await matchFingerprint(
      buildFingerprintMatchPayload(fingerprint, getCustomerUserId())
    );

    if (match.matched && match.url) {
      setResolvedDeepLinkUrl(match.url);
      if (match.clickId || match.pdlSessionId) {
        mergeAttributionParams({
          clickId: match.clickId,
          pdlSessionId: match.pdlSessionId,
        });
      }
      callback?.(match.url);
      return { success: true, url: match.url, message: match.message };
    }

    if (match.error) {
      return { success: false, error: match.error };
    }

    return { success: true, url: null, message: 'No deep link available' };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error occurred' };
  }
}

export function isReady(): boolean {
  return getIsInitialized() && getApiKey() !== null;
}

export function reset(): void {
  resetRuntimeState();
}

export async function flush(): Promise<{
  success: boolean;
  count?: number;
  sessionId?: string;
}> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, count: 0 };
  }

  const result = await flushMmpEvents();
  applySessionFromResponse(result.sessionId);

  return result;
}

export async function trackAnalyticsEvent(
  event: CustomDeepLinkAnalyticsEvent
): Promise<{ success: boolean; queued?: boolean; error?: string }> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }

  const fingerprint = getCachedFingerprint();
  if (!fingerprint) {
    return { success: false, error: 'Browser fingerprint not ready' };
  }

  const {
    eventName,
    userId,
    customerUserId: eventCustomerUserId,
    licenseKey: _ignored,
    pageUrl: _pageUrl,
    pageTitle: _pageTitle,
    ...rest
  } = event as Record<string, unknown>;

  const resolvedUserId =
    (eventCustomerUserId as string | undefined) ||
    getCustomerUserId() ||
    (userId as string | undefined);

  const eventType = mapLegacyEventType(String(event.eventType || 'custom'));
  const properties = {
    ...((rest.properties as Record<string, unknown>) || {}),
    ...(eventName ? { name: eventName } : {}),
    ...(event.category ? { category: event.category } : {}),
    ...(event.action ? { action: event.action } : {}),
    ...(event.label ? { label: event.label } : {}),
    ...(typeof window !== 'undefined' ? { pageUrl: window.location.href } : {}),
    ...(typeof document !== 'undefined' ? { pageTitle: document.title } : {}),
  };

  const payload = buildEventPayload(fingerprint, {
    eventType,
    sessionId: getSessionId(),
    userId: resolvedUserId,
    attribution: getAttributionParams(),
    revenue: rest.revenue !== undefined ? Number(rest.revenue) : undefined,
    currency: rest.currency ? String(rest.currency) : undefined,
    properties: Object.keys(properties).length > 0 ? properties : undefined,
  });

  if (eventType === 'login' || eventType === 'purchase' || eventType === 'app_open') {
    const response = await postMmpEvent(ready.apiKey, payload);
    applySessionFromResponse(response.sessionId);
    if (response.success && (payload.clickId || payload.pdlSessionId)) {
      clearAttributionParams();
    }
    return { success: response.success, error: response.error };
  }

  enqueueMmpEvent(payload, ready.apiKey);
  return { success: true, queued: true };
}

export async function trackConversion(
  payload: Omit<MmpConversionPayload, 'deviceId' | 'platform'>
): Promise<import('./types').MmpConversionResponse> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }

  if (payload.orderId && hasSentOrderId(payload.orderId)) {
    return { success: true };
  }

  const fingerprint = getCachedFingerprint();
  if (!fingerprint) {
    return { success: false, error: 'Browser fingerprint not ready' };
  }

  const userId = getCustomerUserId();
  const fullPayload: MmpConversionPayload = {
    ...payload,
    deviceId: fingerprint.deviceId,
    platform: 'web',
    ...(getSessionId() ? { sessionId: getSessionId()! } : {}),
    ...(userId ? { userId } : {}),
  };

  const response = await postConversion(ready.apiKey, fullPayload);

  if (response.success && payload.orderId) {
    markOrderIdSent(payload.orderId);
  }

  if (response.success && !response.attribution && response.conversionId) {
    const attribution = await fetchAttributionWithRetry(ready.apiKey, response.conversionId);
    if (attribution.success && attribution.attributions) {
      return { ...response, attribution: attribution.attributions };
    }
  }

  return response;
}

/**
 * Track a purchase per the integration guide: purchase event + conversion in parallel.
 */
export async function trackPurchase(
  payload: TrackPurchasePayload
): Promise<{
  success: boolean;
  event?: import('./types').MmpEventResponse;
  conversion?: import('./types').MmpConversionResponse;
  error?: string;
}> {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }

  const fingerprint = getCachedFingerprint();
  if (!fingerprint) {
    return { success: false, error: 'Browser fingerprint not ready' };
  }

  const conversionType = payload.conversionType || 'purchase';
  const { conversionType: _ignored, revenue, currency, ...rest } = payload;

  const purchaseEvent = buildEventPayload(fingerprint, {
    eventType: 'purchase',
    sessionId: getSessionId(),
    userId: getCustomerUserId(),
    attribution: getAttributionParams(),
    revenue,
    currency,
  });

  const conversionPayload: Omit<MmpConversionPayload, 'deviceId' | 'platform'> = {
    conversionType,
    revenue,
    currency,
    ...rest,
  };

  const [eventResult, conversionResult] = await Promise.all([
    postMmpEvent(ready.apiKey, purchaseEvent),
    trackConversion(conversionPayload),
  ]);

  applySessionFromResponse(eventResult.sessionId);

  const success = eventResult.success && conversionResult.success;
  return {
    success,
    event: eventResult,
    conversion: conversionResult,
    error: eventResult.error || conversionResult.error,
  };
}

export async function getAttribution(conversionId: string) {
  const ready = requireInitialized();
  if (!ready.ok) {
    return { success: false, error: ready.error };
  }
  return fetchAttributionWithRetry(ready.apiKey, conversionId);
}

export type {
  InitConfig,
  InitResponse,
  DeepLinkResponse,
  CustomDeepLinkAnalyticsEvent,
  MmpConversionPayload,
  MmpConversionResponse,
  MmpAttributionResponse,
  TrackPurchasePayload,
} from './types';

export class ProDeepLink {
  private apiKey: string;
  private appVersion: string;

  constructor(config: InitConfig) {
    const apiKey = resolveApiKey(config);
    const validation = validateApiKeyFormat(apiKey);
    if (!validation.isValid) {
      throw new Error(validation.message || 'Invalid API key');
    }
    this.apiKey = apiKey;
    this.appVersion = config.appVersion || 'web';
  }

  async initialize(): Promise<InitResponse> {
    return init({ apiKey: this.apiKey, appVersion: this.appVersion });
  }

  async getDeepLinkUrl(): Promise<DeepLinkResponse> {
    return getDeepLink();
  }
}

export default {
  init,
  getDeepLink,
  isReady,
  reset,
  updateSessionId,
  setCustomerUserId,
  trackAnalyticsEvent,
  trackPurchase,
  trackConversion,
  getAttribution,
  flush,
};
