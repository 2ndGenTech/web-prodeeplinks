import { InitConfig, LicenseValidationResult } from './types';

export function resolveApiKey(config: InitConfig): string {
  const apiKey = (config.apiKey || config.licenseKey || '').trim();
  if (config.licenseKey && !config.apiKey) {
    console.warn('[ProDeepLink] `licenseKey` is deprecated — use `apiKey` instead.');
  }
  return apiKey;
}

export function validateApiKeyFormat(apiKey: string): LicenseValidationResult {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return {
      isValid: false,
      message: 'API key is required',
    };
  }

  const key = apiKey.trim();
  const isCanonicalPk =
    key.startsWith('pdl_live_pk_') ||
    key.startsWith('pdl_test_pk_');
  const isLegacyPub =
    key.startsWith('cdl_pub_live_') ||
    key.startsWith('cdl_pub_test_');
  const isLegacy =
    key.startsWith('pdl_live_') ||
    key.startsWith('pdl_test_') ||
    key.startsWith('ak_app_') ||
    key.startsWith('CDL-V1-') ||
    key.includes('live') ||
    key.includes('test');

  if (!isCanonicalPk && !isLegacyPub && !isLegacy) {
    return {
      isValid: false,
      message: 'Invalid API key format. Expected pdl_live_pk_* or pdl_test_pk_*',
    };
  }

  if (key.startsWith('pdl_live_sk_') || key.startsWith('pdl_test_sk_')) {
    return {
      isValid: false,
      message: 'Secret keys (sk) must not be embedded in client-side code. Use publishable keys (pk).',
    };
  }

  return { isValid: true };
}

/** @deprecated Use validateApiKeyFormat */
export function validateLicenseKeyFormat(licenseKey: string): LicenseValidationResult {
  return validateApiKeyFormat(licenseKey);
}
