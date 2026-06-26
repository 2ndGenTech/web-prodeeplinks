export interface DeepLinkAttributionParams {
  clickId?: string;
  pdlSessionId?: string;
  shortCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export function parseDeepLinkParams(url: string): DeepLinkAttributionParams {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return {};
  }

  const query = url.slice(queryStart + 1);
  const params = new URLSearchParams(query);

  const pick = (key: string) => params.get(key) || undefined;

  return {
    clickId: pick('clickId'),
    pdlSessionId: pick('pdlSessionId'),
    shortCode: pick('shortCode'),
    utmSource: pick('utm_source'),
    utmMedium: pick('utm_medium'),
    utmCampaign: pick('utm_campaign'),
    utmContent: pick('utm_content'),
    utmTerm: pick('utm_term'),
  };
}

export function parsePageAttributionParams(): DeepLinkAttributionParams {
  if (typeof window === 'undefined') {
    return {};
  }
  return parseDeepLinkParams(window.location.href);
}
