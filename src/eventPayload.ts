import { buildMmpEventFromFingerprint } from './api';
import { DeepLinkAttributionParams } from './deeplinkParams';
import { BrowserFingerprint, MmpEventPayload } from './types';

export function mapLegacyEventType(eventType: string): string {
  if (eventType === 'identify') return 'login';
  if (eventType === 'pro_track') return 'custom';
  if (eventType === 'deeplink') return 'app_open';
  return eventType;
}

export function buildEventPayload(
  fingerprint: BrowserFingerprint,
  options: {
    eventType: string;
    sessionId?: string | null;
    userId?: string | null;
    attribution?: DeepLinkAttributionParams;
    revenue?: number;
    currency?: string;
    properties?: Record<string, unknown>;
  }
): MmpEventPayload {
  const attrs = options.attribution || {};

  return buildMmpEventFromFingerprint(fingerprint, {
    eventType: options.eventType,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.userId ? { userId: options.userId, customerUserId: options.userId } : {}),
    ...(attrs.clickId ? { clickId: attrs.clickId } : {}),
    ...(attrs.pdlSessionId ? { pdlSessionId: attrs.pdlSessionId } : {}),
    ...(attrs.shortCode ? { shortCode: attrs.shortCode } : {}),
    ...(attrs.utmSource ? { utmSource: attrs.utmSource } : {}),
    ...(attrs.utmMedium ? { utmMedium: attrs.utmMedium } : {}),
    ...(attrs.utmCampaign ? { utmCampaign: attrs.utmCampaign } : {}),
    ...(attrs.utmContent ? { utmContent: attrs.utmContent } : {}),
    ...(attrs.utmTerm ? { utmTerm: attrs.utmTerm } : {}),
    ...(options.revenue !== undefined ? { revenue: options.revenue } : {}),
    ...(options.currency ? { currency: options.currency } : {}),
    ...(options.properties && Object.keys(options.properties).length > 0
      ? { properties: options.properties }
      : {}),
  });
}
