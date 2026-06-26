import { DeepLinkAttributionParams } from './deeplinkParams';
import { BrowserFingerprint } from './types';

export const DEFAULT_BASE_URL = 'https://api.prodeeplinks.com';

let storedApiKey: string | null = null;
let storedBaseUrl = DEFAULT_BASE_URL;
let storedAppVersion = 'web';
let isInitialized = false;
let sessionId: string | null = null;
let customerUserId: string | null = null;
let cachedFingerprint: BrowserFingerprint | null = null;
let attributionParams: DeepLinkAttributionParams = {};
let resolvedDeepLinkUrl: string | null = null;
const sentOrderIds = new Set<string>();

export function getApiKey(): string | null {
  return storedApiKey;
}

export function setApiKey(key: string | null): void {
  storedApiKey = key;
}

export function getBaseUrl(): string {
  return storedBaseUrl;
}

export function setBaseUrl(url: string): void {
  storedBaseUrl = url.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

export function getAppVersion(): string {
  return storedAppVersion;
}

export function setAppVersion(version: string): void {
  storedAppVersion = version;
}

export function getIsInitialized(): boolean {
  return isInitialized;
}

export function setIsInitialized(value: boolean): void {
  isInitialized = value;
}

export function getSessionId(): string | null {
  return sessionId;
}

export function setSessionId(value: string | null | undefined): void {
  sessionId = value ? String(value) : null;
}

export function getCustomerUserId(): string | null {
  return customerUserId;
}

export function setCustomerUserIdValue(value: string | null): void {
  customerUserId = value;
}

export function getCachedFingerprint(): BrowserFingerprint | null {
  return cachedFingerprint;
}

export function setCachedFingerprint(value: BrowserFingerprint | null): void {
  cachedFingerprint = value;
}

export function getAttributionParams(): DeepLinkAttributionParams {
  return attributionParams;
}

export function mergeAttributionParams(params: DeepLinkAttributionParams): void {
  attributionParams = {
    clickId: params.clickId ?? attributionParams.clickId,
    pdlSessionId: params.pdlSessionId ?? attributionParams.pdlSessionId,
    shortCode: params.shortCode ?? attributionParams.shortCode,
    utmSource: params.utmSource ?? attributionParams.utmSource,
    utmMedium: params.utmMedium ?? attributionParams.utmMedium,
    utmCampaign: params.utmCampaign ?? attributionParams.utmCampaign,
    utmContent: params.utmContent ?? attributionParams.utmContent,
    utmTerm: params.utmTerm ?? attributionParams.utmTerm,
  };
}

export function getResolvedDeepLinkUrl(): string | null {
  return resolvedDeepLinkUrl;
}

export function setResolvedDeepLinkUrl(url: string | null): void {
  resolvedDeepLinkUrl = url;
}

export function clearAttributionParams(): void {
  attributionParams = {};
}

export function hasSentOrderId(orderId: string): boolean {
  return sentOrderIds.has(orderId);
}

export function markOrderIdSent(orderId: string): void {
  sentOrderIds.add(orderId);
}

export function resetRuntimeState(): void {
  storedApiKey = null;
  storedBaseUrl = DEFAULT_BASE_URL;
  storedAppVersion = 'web';
  isInitialized = false;
  sessionId = null;
  customerUserId = null;
  cachedFingerprint = null;
  attributionParams = {};
  resolvedDeepLinkUrl = null;
  sentOrderIds.clear();
}
