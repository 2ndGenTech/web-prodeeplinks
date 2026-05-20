import { LicenseValidationResult } from './types';

export function validateLicenseKeyFormat(licenseKey: string): LicenseValidationResult {
  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
    return {
      isValid: false,
      message: 'License key is required',
    };
  }

  return {
    isValid: true,
  };
}
