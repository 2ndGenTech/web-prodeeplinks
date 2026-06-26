import { BrowserFingerprint, FingerprintMatchPayload } from './types';

const DEVICE_ID_KEY = 'pdl_device_id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function parseOsFromUserAgent(userAgent: string): { os: string; version: string } {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows nt')) {
    const match = userAgent.match(/Windows NT ([\d.]+)/i);
    return { os: 'windows', version: match?.[1] || 'unknown' };
  }
  if (ua.includes('mac os x') || ua.includes('macintosh')) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/i);
    return { os: 'macos', version: (match?.[1] || 'unknown').replace(/_/g, '.') };
  }
  if (ua.includes('android')) {
    const match = userAgent.match(/Android ([\d.]+)/i);
    return { os: 'android', version: match?.[1] || 'unknown' };
  }
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    const match = userAgent.match(/OS ([\d_]+)/i);
    return { os: 'ios', version: (match?.[1] || 'unknown').replace(/_/g, '.') };
  }
  if (ua.includes('linux')) {
    return { os: 'linux', version: 'unknown' };
  }

  return { os: 'web', version: 'unknown' };
}

function parseDeviceModel(userAgent: string, os: string): string {
  if (os === 'ios') {
    if (/ipad/i.test(userAgent)) return 'iPad';
    if (/iphone/i.test(userAgent)) return 'iPhone';
    if (/ipod/i.test(userAgent)) return 'iPod';
  }
  if (os === 'android') {
    const match = userAgent.match(/;\s([^;)]+)\sBuild\//i);
    if (match?.[1]) return match[1].trim();
  }
  if (os === 'macos') return 'Mac';
  if (os === 'windows') return 'PC';

  return 'Browser';
}

function getConnectionType(): string | undefined {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string };
    mozConnection?: { effectiveType?: string; type?: string };
    webkitConnection?: { effectiveType?: string; type?: string };
  };

  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  return connection?.effectiveType || connection?.type;
}

/**
 * Generate browser fingerprint for deep link matching.
 * Safe to call only in browser environments (window defined).
 */
export function generateBrowserFingerprint(appVersion = 'web'): BrowserFingerprint {
  const userAgent = navigator.userAgent;
  const { os, version } = parseOsFromUserAgent(userAgent);
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const locale = navigator.language || Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  const language = locale.split('-')[0] || 'en';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    platform: os,
    osVersion: version,
    deviceModel: parseDeviceModel(userAgent, os),
    deviceId: getOrCreateDeviceId(),
    screenResolution: `${screenWidth}x${screenHeight}`,
    screenWidth,
    screenHeight,
    timezone,
    language,
    locale,
    userAgent,
    appVersion,
    connectionType: getConnectionType(),
  };
}

/**
 * Read a deep link URL from the current page if present.
 * Checks common query params and hash-based redirects.
 */
export function getInitialUrlFromPage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const paramNames = ['url', 'deeplink', 'link', 'redirect', 'target', 'dl'];

  for (const name of paramNames) {
    const value = params.get(name);
    if (value) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  if (window.location.hash.length > 1) {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('http://') || hash.startsWith('https://')) {
      return hash;
    }
  }

  return null;
}

export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function buildFingerprintMatchPayload(
  fingerprint: BrowserFingerprint,
  customerUserId?: string | null
): FingerprintMatchPayload {
  return {
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
    ...(customerUserId ? { customerUserId } : {}),
  };
}
