export type MmpPlatform = 'ios' | 'android' | 'web';

export interface BrowserFingerprint {
  platform: string;
  osVersion: string;
  deviceModel: string;
  deviceId: string;
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
  /** Preferred — publishable API key (`pdl_live_pk_*` / `pdl_test_pk_*`) */
  apiKey?: string;
  /** @deprecated Use `apiKey` instead */
  licenseKey?: string;
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

export interface InitResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
  resolvedEventType?: 'install' | 'app_open';
  attributionType?: string;
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
  customerUserId?: string;
  userId?: string;
}

export interface MmpEventPayload {
  eventType: string;
  deviceId: string;
  platform: MmpPlatform;
  sessionId?: string;
  userId?: string;
  customerUserId?: string;
  clickId?: string;
  pdlSessionId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  osVersion?: string;
  deviceModel?: string;
  screenSize?: string;
  networkType?: string;
  language?: string;
  timezone?: string;
  appVersion?: string;
  sdkVersion?: string;
  revenue?: number;
  currency?: string;
  shortCode?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface MmpEventResponse {
  success: boolean;
  eventId?: string;
  sessionId?: string;
  resolvedEventType?: 'install' | 'app_open';
  attributionType?: string;
  source?: string;
  campaign?: string;
  error?: string;
}

export interface MmpBatchResponse {
  success: boolean;
  count?: number;
  sessionId?: string;
  resolvedEventType?: 'install' | 'app_open';
  attributionType?: string | null;
  source?: string | null;
  campaign?: string | null;
  eventIds?: string[];
  error?: string;
}

export type TrackPurchasePayload = Omit<
  MmpConversionPayload,
  'deviceId' | 'platform' | 'conversionType'
> & {
  conversionType?: string;
  revenue: number;
};

export interface MmpConversionPayload {
  conversionType: string;
  deviceId: string;
  platform: MmpPlatform;
  sessionId?: string;
  userId?: string;
  timestamp?: string;
  revenue?: number;
  currency?: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  category?: string;
  quantity?: number;
  properties?: Record<string, unknown>;
}

export interface MmpAttributionTouchpoint {
  source: string;
  campaign?: string | null;
  timestamp: string;
  weight: number;
}

export interface MmpAttributionResult {
  conversionId: string;
  attributedSource?: string;
  attributedCampaign?: string;
  attributedRevenue?: number;
  model?: string;
  touchpoints?: MmpAttributionTouchpoint[];
}

export interface MmpConversionResponse {
  success: boolean;
  conversionId?: string;
  attribution?: MmpAttributionResult | null;
  error?: string;
}

export interface MmpAttributionResponse {
  success: boolean;
  attributions?: MmpAttributionResult;
  error?: string;
}

/** @deprecated Use MmpEventPayload */
export interface CustomDeepLinkAnalyticsEvent {
  licenseKey?: string;
  eventType: string;
  eventName?: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  properties?: Record<string, unknown>;
  sessionId?: string;
  customerUserId?: string;
  userId?: string;
  pageUrl?: string;
  pageTitle?: string;
  revenue?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface LicenseValidationApiResponse {
  success: boolean;
  valid?: boolean;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface FingerprintMatchInstallInfo {
  _id: string;
  linkId: string;
  installedAt: string;
  timeToInstall: number;
  [key: string]: unknown;
}

export interface DeepLinkContextMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface DeepLinkContext {
  action: string;
  resourceId?: string;
  params?: Record<string, unknown>;
  metadata?: DeepLinkContextMetadata;
  campaign?: string;
  source?: string;
  [key: string]: unknown;
}

export interface FingerprintMatchResponse {
  matched: boolean;
  matchConfidence?: number;
  clickId?: string;
  pdlSessionId?: string;
  url?: string | null;
  install?: FingerprintMatchInstallInfo;
  deepLinkContext?: DeepLinkContext;
  message?: string;
  error?: string;
}
