import {
  BrowserFingerprint,
  DeepLinkResponse,
  FingerprintMatchPayload,
  FingerprintMatchResponse,
  LicenseValidationApiResponse,
  MmpAttributionResponse,
  MmpBatchResponse,
  MmpConversionPayload,
  MmpConversionResponse,
  MmpEventPayload,
  MmpEventResponse,
} from './types';
import { getBaseUrl } from './runtime';

export const SDK_VERSION = '0.2.0';

const MAX_QUEUE_SIZE = 1000;
const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;

let queuedMmpEvents: Array<{ apiKey: string; event: MmpEventPayload }> = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function buildMmpHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
    'x-api-key': apiKey,
    'X-SDK-Version': SDK_VERSION,
    'X-SDK-Platform': 'web',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logDeprecationHeaders(res: Response): void {
  const deprecated = res.headers.get('X-Api-Key-Deprecation');
  if (deprecated === 'true') {
    const message =
      res.headers.get('X-Api-Key-Deprecation-Message') ||
      'You are using a legacy API key. Migrate to pdl_live_pk_* or pdl_test_pk_*.';
    console.warn('[ProDeepLink]', message);
  }
}

async function mmpFetch(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    logDeprecationHeaders(res);

    if (res.status !== 429 || attempt === maxRetries) {
      return res;
    }

    await sleep(Math.min(delayMs, 30_000));
    delayMs *= 2;
  }

  return fetch(url, init);
}

function endpoint(path: string, baseUrl?: string): string {
  const base = (baseUrl || getBaseUrl()).replace(/\/+$/, '');
  return `${base}${path}`;
}

export async function postMmpEvent(
  apiKey: string,
  event: MmpEventPayload,
  baseUrl?: string
): Promise<MmpEventResponse> {
  try {
    const res = await mmpFetch(endpoint('/v1/mmp/events', baseUrl), {
      method: 'POST',
      headers: buildMmpHeaders(apiKey),
      body: JSON.stringify(event),
    });

    const data = (await res.json().catch(() => ({}))) as MmpEventResponse & {
      message?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `MMP event failed: ${res.status}`,
      };
    }

    return {
      success: Boolean(data.success ?? true),
      eventId: data.eventId,
      sessionId: data.sessionId,
      resolvedEventType: data.resolvedEventType,
      attributionType: data.attributionType,
      source: data.source,
      campaign: data.campaign,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'MMP event request failed' };
  }
}

export async function postMmpEventWithRetry(
  apiKey: string,
  event: MmpEventPayload,
  maxRetries = 3,
  baseUrl?: string
): Promise<MmpEventResponse> {
  let last: MmpEventResponse = { success: false, error: 'Unknown error' };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    last = await postMmpEvent(apiKey, event, baseUrl);
    if (last.success) {
      return last;
    }
    if (attempt < maxRetries) {
      await sleep(1000 * attempt);
    }
  }

  return last;
}

export async function postMmpEventBatch(
  apiKey: string,
  events: MmpEventPayload[],
  baseUrl?: string
): Promise<MmpBatchResponse> {
  if (events.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const res = await mmpFetch(endpoint('/v1/mmp/events/batch', baseUrl), {
      method: 'POST',
      headers: buildMmpHeaders(apiKey),
      body: JSON.stringify({ events }),
    });

    const data = (await res.json().catch(() => ({}))) as MmpBatchResponse & {
      message?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `MMP batch failed: ${res.status}`,
      };
    }

    return {
      success: Boolean(data.success ?? true),
      count: data.count ?? events.length,
      sessionId: data.sessionId,
      resolvedEventType: data.resolvedEventType,
      attributionType: data.attributionType,
      source: data.source,
      campaign: data.campaign,
      eventIds: data.eventIds,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'MMP batch request failed' };
  }
}

export async function postConversion(
  apiKey: string,
  payload: MmpConversionPayload,
  baseUrl?: string
): Promise<MmpConversionResponse> {
  try {
    const res = await mmpFetch(endpoint('/v1/mmp/conversions', baseUrl), {
      method: 'POST',
      headers: buildMmpHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as MmpConversionResponse & {
      message?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `Conversion failed: ${res.status}`,
      };
    }

    return {
      success: Boolean(data.success ?? true),
      conversionId: data.conversionId,
      attribution: data.attribution ?? null,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Conversion request failed' };
  }
}

export async function fetchAttribution(
  apiKey: string,
  conversionId: string,
  baseUrl?: string
): Promise<MmpAttributionResponse> {
  try {
    const res = await mmpFetch(endpoint(`/v1/mmp/attribution/${conversionId}`, baseUrl), {
      method: 'GET',
      headers: buildMmpHeaders(apiKey),
    });

    const data = (await res.json().catch(() => ({}))) as MmpAttributionResponse & {
      message?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        error: data.message || data.error || `Attribution fetch failed: ${res.status}`,
      };
    }

    return {
      success: Boolean(data.success ?? true),
      attributions: data.attributions,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Attribution request failed' };
  }
}

export async function fetchAttributionWithRetry(
  apiKey: string,
  conversionId: string,
  maxRetries = 3,
  baseUrl?: string
): Promise<MmpAttributionResponse> {
  let last: MmpAttributionResponse = { success: false, error: 'Unknown error' };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    last = await fetchAttribution(apiKey, conversionId, baseUrl);
    if (last.success && last.attributions) {
      return last;
    }
    if (attempt < maxRetries) {
      await sleep(2000);
    }
  }

  return last;
}

export async function matchFingerprint(
  payload: FingerprintMatchPayload,
  baseUrl?: string
): Promise<FingerprintMatchResponse> {
  try {
    const res = await fetch(endpoint('/custom-deep-link/fingerprint/match', baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as FingerprintMatchResponse;
    if (res.ok) {
      console.log('[ProDeepLink] fingerprint match API success', {
        matched: data?.matched,
        matchConfidence: data?.matchConfidence,
      });
    } else {
      console.warn('[ProDeepLink] fingerprint match API non-OK response', {
        status: res.status,
        statusText: res.statusText,
      });
    }
    return data;
  } catch (e: any) {
    console.error('[ProDeepLink] fingerprint match API error', e?.message || e);
    return {
      matched: false,
      matchConfidence: 0,
      error: e?.message || 'Fingerprint match failed',
    };
  }
}

/** @deprecated Use matchFingerprint */
export const matchFingerprintCustom = matchFingerprint;

export async function validateLicenseLegacy(
  licenseKey: string,
  baseUrl?: string
): Promise<LicenseValidationApiResponse> {
  try {
    const res = await fetch(endpoint('/custom-deep-link/license/validate', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });
    return (await res.json().catch(() => ({}))) as LicenseValidationApiResponse;
  } catch (e: any) {
    return { success: false, error: e?.message || 'License validate failed' };
  }
}

/** @deprecated Use validateApiKeyFormat — remote validation is optional */
export async function validateLicenseInit(
  licenseKey: string,
  baseUrl?: string
): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  data?: LicenseValidationApiResponse;
}> {
  try {
    const data = await validateLicenseLegacy(licenseKey, baseUrl);
    if (!data.success || !data.valid) {
      const message = data?.message || data?.error || 'License is not valid';
      return { success: false, error: message, data };
    }
    return { success: true, data };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'License validation request failed',
    };
  }
}

/** @deprecated Use postMmpEvent via trackAnalyticsEvent */
export async function trackCustomDeepLinkEvent(
  event: Record<string, unknown>,
  _licenseKey?: string
): Promise<{ success: boolean; error?: string }> {
  console.warn(
    '[ProDeepLink] trackCustomDeepLinkEvent is deprecated — use trackAnalyticsEvent with MMP events'
  );
  return { success: false, error: 'Use trackAnalyticsEvent instead' };
}

export function enqueueMmpEvent(event: MmpEventPayload, apiKey: string): void {
  if (queuedMmpEvents.length >= MAX_QUEUE_SIZE) {
    queuedMmpEvents.shift();
  }
  queuedMmpEvents.push({ apiKey, event });
  ensureFlushTimer();
  if (queuedMmpEvents.length >= MAX_BATCH_SIZE) {
    flushMmpEvents().catch(() => {});
  }
}

export function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushMmpEvents().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

export async function flushMmpEvents(): Promise<MmpBatchResponse> {
  if (queuedMmpEvents.length === 0) {
    return { success: true, count: 0 };
  }

  const firstKey = queuedMmpEvents[0]?.apiKey;
  if (!firstKey) {
    return { success: false, error: 'Missing API key in queue' };
  }

  const batchItems = queuedMmpEvents
    .filter((x) => x.apiKey === firstKey)
    .slice(0, MAX_BATCH_SIZE);

  const remaining: typeof queuedMmpEvents = [];
  let removed = 0;
  for (const item of queuedMmpEvents) {
    if (removed < batchItems.length && item.apiKey === firstKey) {
      removed += 1;
      continue;
    }
    remaining.push(item);
  }
  queuedMmpEvents = remaining;

  const result = await postMmpEventBatch(
    firstKey,
    batchItems.map((x) => x.event)
  );

  if (!result.success) {
    queuedMmpEvents = [...batchItems, ...queuedMmpEvents];
  }

  return result;
}

/** @deprecated Legacy deep link fetch — prefer getDeepLink() + fingerprint match */
export async function fetchDeepLinkUrlWithRetry(
  apiKey: string,
  fingerprint: BrowserFingerprint,
  retryAttempts = 3,
  apiEndpoint?: string
): Promise<DeepLinkResponse> {
  const payload: FingerprintMatchPayload = {
    basic: {
      userAgent: fingerprint.userAgent,
      language: fingerprint.language || 'en',
      platform: fingerprint.platform,
      screenResolution: fingerprint.screenResolution,
      timezone: fingerprint.timezone || '',
      timezoneOffset: new Date().getTimezoneOffset(),
    },
    network: {
      ipAddress: fingerprint.ipAddress || '',
      connectionType: fingerprint.connectionType || '',
    },
    device: {
      deviceModel: fingerprint.deviceModel,
      osVersion: fingerprint.osVersion,
      appVersion: fingerprint.appVersion,
    },
  };

  let last: DeepLinkResponse = { success: false, error: 'Fingerprint match failed' };
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    const match = await matchFingerprint(payload, apiEndpoint);
    if (match.matched && match.url) {
      return { success: true, url: match.url, message: match.message };
    }
    last = {
      success: match.matched ? true : false,
      url: match.url ?? null,
      message: match.message || 'No deep link available',
      error: match.error,
    };
    if (match.matched || match.error) {
      return last;
    }
    if (attempt < retryAttempts) {
      await sleep(1000 * attempt);
    }
  }
  return last;
}

export function buildMmpEventFromFingerprint(
  fingerprint: BrowserFingerprint,
  overrides: Partial<MmpEventPayload> = {}
): MmpEventPayload {
  return {
    eventType: 'custom',
    deviceId: fingerprint.deviceId,
    platform: 'web',
    osVersion: fingerprint.osVersion,
    deviceModel: fingerprint.deviceModel,
    screenSize: fingerprint.screenResolution,
    networkType: fingerprint.connectionType,
    language: fingerprint.language,
    timezone: fingerprint.timezone,
    appVersion: fingerprint.appVersion,
    sdkVersion: SDK_VERSION,
    ...overrides,
  };
}
