import {
  InitConfig,
  DeepLinkResponse,
  CustomDeepLinkAnalyticsEvent,
  BrowserFingerprint,
  FingerprintMatchPayload,
} from './types';
import {
  generateBrowserFingerprint,
  getInitialUrlFromPage,
  isBrowserEnvironment,
} from './fingerprint';
import {
  fetchDeepLinkUrlWithRetry,
  validateLicenseInit,
  trackCustomDeepLinkEvent,
  matchFingerprintCustom,
} from './api';
import { validateLicenseKeyFormat } from './license';

let storedLicenseKey: string | null = null;
let storedAppVersion = 'web';
let isInitialized = false;

const DEFAULT_API_ENDPOINT = 'https://api.prodeeplinks.com/';

/**
 * Initialize the deep link SDK with a license key.
 * Must be called before getDeepLink().
 */
export async function init(config: InitConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = validateLicenseKeyFormat(config.licenseKey);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.message || 'Invalid license key',
      };
    }

    const remoteValidation = await validateLicenseInit(config.licenseKey);
    if (!remoteValidation.success) {
      return {
        success: false,
        error: remoteValidation.error || 'License validation failed',
      };
    }

    storedLicenseKey = config.licenseKey;
    storedAppVersion = config.appVersion || 'web';
    isInitialized = true;

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to initialize',
    };
  }
}

async function trackDeepLinkResolved(
  url: string,
  source: 'url' | 'api',
  fingerprint?: BrowserFingerprint
): Promise<void> {
  const event: CustomDeepLinkAnalyticsEvent = {
    eventType: 'deeplink',
    eventName: 'pro_track',
    category: source,
    action: 'open',
    label: url,
    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    pageTitle: typeof document !== 'undefined' ? document.title : undefined,
    properties: {
      shortUrl: url,
      source,
      fingerprint,
    },
  };

  try {
    await trackAnalyticsEvent(event);
  } catch {
    // analytics should not block deep link resolution
  }
}

/**
 * Resolve a deep link URL.
 *
 * Flow (same as rn-prodeeplinks):
 * 1. Fingerprint match via API
 * 2. Fallback to URL query/hash on the current page
 * 3. Return null if neither is available
 */
export async function getDeepLink(
  callback?: (url: string) => void
): Promise<DeepLinkResponse> {
  if (!isInitialized || !storedLicenseKey) {
    return {
      success: false,
      error: 'Please call init() first with your license key',
    };
  }

  if (!isBrowserEnvironment()) {
    return {
      success: false,
      error: 'getDeepLink() must be called in the browser',
    };
  }

  try {
    const fingerprint = generateBrowserFingerprint(storedAppVersion);
    const matchPayload: FingerprintMatchPayload = {
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

    let apiError: string | undefined;

    try {
      const matchResult = await matchFingerprintCustom(
        matchPayload,
        DEFAULT_API_ENDPOINT,
        storedLicenseKey
      );
      const apiUrl = matchResult?.url;

      if (apiUrl) {
        try {
          await trackDeepLinkResolved(apiUrl, 'api', fingerprint);
        } catch {
          // ignore analytics errors
        }
        if (callback) {
          callback(apiUrl);
        }
        return {
          success: true,
          url: apiUrl,
          message: matchResult?.message,
        };
      }

      if (matchResult?.error) {
        apiError = String(matchResult.error);
      }
    } catch (e: any) {
      apiError = e?.message || 'Fingerprint match failed';
    }

    const initialUrl = getInitialUrlFromPage();
    if (initialUrl) {
      try {
        await trackDeepLinkResolved(initialUrl, 'url', fingerprint);
      } catch {
        // ignore analytics errors
      }
      if (callback) {
        callback(initialUrl);
      }
      return { success: true, url: initialUrl };
    }

    if (apiError) {
      return {
        success: false,
        error: apiError,
      };
    }

    return {
      success: true,
      url: null,
      message: 'No deep link available',
    };
  } catch (error: any) {
    console.error('Error in getDeepLink:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

export function isReady(): boolean {
  return isInitialized && storedLicenseKey !== null;
}

export function reset(): void {
  storedLicenseKey = null;
  storedAppVersion = 'web';
  isInitialized = false;
}

export async function trackAnalyticsEvent(
  event: CustomDeepLinkAnalyticsEvent
): Promise<any> {
  if (!isInitialized || !storedLicenseKey) {
    return {
      success: false,
      error: 'Please call init() first with your license key',
    };
  }

  const { licenseKey: _ignored, ...payload } = event as CustomDeepLinkAnalyticsEvent & {
    licenseKey?: string;
  };
  return trackCustomDeepLinkEvent(payload, storedLicenseKey);
}

export class ProDeepLink {
  private licenseKey: string;
  private appVersion: string;

  constructor(config: InitConfig) {
    const validation = validateLicenseKeyFormat(config.licenseKey);
    if (!validation.isValid) {
      throw new Error(validation.message || 'Invalid license key');
    }
    this.licenseKey = config.licenseKey;
    this.appVersion = config.appVersion || 'web';
  }

  async getDeepLinkUrl(): Promise<DeepLinkResponse> {
    const remoteValidation = await validateLicenseInit(this.licenseKey);
    if (!remoteValidation.success) {
      return {
        success: false,
        error: remoteValidation.error || 'License validation failed',
      };
    }

    if (!isBrowserEnvironment()) {
      return {
        success: false,
        error: 'getDeepLinkUrl() must be called in the browser',
      };
    }

    const fingerprint = generateBrowserFingerprint(this.appVersion);
    const result = await fetchDeepLinkUrlWithRetry(
      this.licenseKey,
      fingerprint,
      3,
      DEFAULT_API_ENDPOINT
    );

    if (result.success && result.url) {
      try {
        await trackDeepLinkResolved(result.url, 'api', fingerprint);
      } catch {
        // ignore analytics errors
      }
    }

    return result;
  }
}

export type { InitConfig, DeepLinkResponse, CustomDeepLinkAnalyticsEvent } from './types';

export default { init, getDeepLink, isReady, reset, trackAnalyticsEvent };
