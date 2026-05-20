import {
  BrowserFingerprint,
  DeepLinkResponse,
  FingerprintMatchPayload,
  CustomDeepLinkAnalyticsEvent,
  LicenseValidationApiResponse,
  FingerprintMatchResponse,
} from './types';
import { validateLicenseKeyFormat } from './license';

const BASE_API_URL = 'https://api.prodeeplinks.com';
const DEEP_LINK_ENDPOINT_PATH = '/custom-deep-link/fingerprint/match';
const ANALYTICS_ENDPOINT = `${BASE_API_URL}/custom-deep-link/track/event`;

export async function validateLicenseInit(licenseKey: string): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  data?: LicenseValidationApiResponse;
}> {
  try {
    const endpoint = `${BASE_API_URL}/custom-deep-link/license/validate`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-license-key': licenseKey,
      },
      body: JSON.stringify({ licenseKey }),
    });
    const data = (await res.json().catch(() => ({}))) as LicenseValidationApiResponse;
    if (!res.ok) {
      const message = data?.message || data?.error || 'License validation failed';
      return { success: false, error: message, status: res.status, data };
    }
    if (!data.success || !data.valid) {
      const message = data?.message || data?.error || 'License is not valid';
      return { success: false, error: message, status: res.status, data };
    }
    return { success: true, status: res.status, data };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'License validation request failed',
    };
  }
}

export async function matchFingerprintCustom(
  payload: FingerprintMatchPayload,
  baseUrl?: string,
  licenseKey?: string
): Promise<FingerprintMatchResponse> {
  try {
    const base = (baseUrl || BASE_API_URL).trim().replace(/\/+$/, '');
    const endpoint = `${base}/custom-deep-link/fingerprint/match`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(licenseKey ? { 'x-license-key': licenseKey } : {}),
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

export async function trackCustomDeepLinkEvent(
  event: CustomDeepLinkAnalyticsEvent,
  licenseKey?: string
): Promise<any> {
  try {
    const res = await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(licenseKey ? { 'x-license-key': licenseKey } : {}),
      },
      body: JSON.stringify(event),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log('[ProDeepLink] track event API success', {
        eventType: event?.eventType,
        eventName: event?.eventName,
      });
    } else {
      console.warn('[ProDeepLink] track event API non-OK response', {
        status: res.status,
        statusText: res.statusText,
      });
    }
    return data;
  } catch (e: any) {
    console.error('[ProDeepLink] track event API error', e?.message || e);
    return { success: false, error: e?.message || 'Analytics event tracking failed' };
  }
}

export async function fetchDeepLinkUrlWithRetry(
  licenseKey: string,
  fingerprint: BrowserFingerprint,
  retryAttempts: number = 3,
  apiEndpoint?: string,
  timeout: number = 10000
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

  let lastError: DeepLinkResponse | null = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    const validation = validateLicenseKeyFormat(licenseKey);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.message || 'Invalid license key',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const base = (apiEndpoint || BASE_API_URL).trim().replace(/\/+$/, '');
      const endpoint = base.includes('/custom-deep-link/')
        ? base
        : `${base}${DEEP_LINK_ENDPOINT_PATH}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-license-key': licenseKey,
        },
        body: JSON.stringify({
          licenseKey,
          fingerprint,
          timestamp: Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastError = {
          success: false,
          error: errorData.message || `API error: ${response.status}`,
        };
      } else {
        const data = await response.json();
        if (data.success) {
          return {
            success: true,
            url: data.url ?? null,
            message: data.message,
          };
        }
        lastError = {
          success: false,
          error: data.message || 'No URL returned from API',
        };
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        lastError = { success: false, error: 'Request timeout' };
      } else {
        lastError = {
          success: false,
          error: fetchError.message || 'Failed to fetch deep link URL',
        };
      }
    }

    if (lastError?.error?.includes('license') || lastError?.error?.includes('Invalid')) {
      return lastError;
    }

    if (attempt < retryAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return lastError || { success: false, error: 'Failed after retries' };
}
