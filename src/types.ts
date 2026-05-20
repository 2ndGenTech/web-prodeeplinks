export interface BrowserFingerprint {
  platform: string;
  osVersion: string;
  deviceModel: string;
  screenResolution: string;
  screenWidth: number;
  screenHeight: number;
  timezone?: string;
  language?: string;
  locale?: string;
  userAgent: string;
  appVersion: string;
  connectionType?: string;
  ipAddress?: string;
}

export interface InitConfig {
  licenseKey: string;
  apiBaseUrl?: string;
  apiPrefix?: string;
  domain?: string;
  /** App/site version sent in fingerprint (defaults to "web") */
  appVersion?: string;
}

export interface DeepLinkResponse {
  success: boolean;
  url?: string | null;
  message?: string;
  error?: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  message?: string;
}

export interface FingerprintBasicPayload {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  timezoneOffset: number;
}

export interface FingerprintNetworkPayload {
  ipAddress: string;
  connectionType: string;
}

export interface FingerprintDevicePayload {
  deviceModel: string;
  osVersion: string;
  appVersion: string;
}

export interface FingerprintMatchPayload {
  basic: FingerprintBasicPayload;
  network: FingerprintNetworkPayload;
  device: FingerprintDevicePayload;
  userId?: string;
}

export interface CustomDeepLinkAnalyticsDeviceInfo {
  userAgent?: string;
  language?: string;
  screenResolution?: string;
  platform?: string;
  [key: string]: any;
}

export interface CustomDeepLinkAnalyticsEvent {
  licenseKey?: string;
  eventType: string;
  eventName: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  properties?: { [key: string]: any };
  sessionId?: string;
  userId?: string;
  pageUrl?: string;
  pageTitle?: string;
  deviceInfo?: CustomDeepLinkAnalyticsDeviceInfo;
  [key: string]: any;
}

export interface LicenseValidationApiResponse {
  success: boolean;
  valid?: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface FingerprintMatchResponse {
  matched?: boolean;
  matchConfidence?: number;
  url?: string | null;
  message?: string;
  error?: string;
  [key: string]: any;
}
