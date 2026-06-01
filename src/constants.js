// Shared constants for the Plummer worker.

export const RESERVED = new Set([
  'admin',
  'api',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

export const ADMIN_REALM = 'Plummer Admin';

// Visible build version displayed in the UI footer.
export const APP_VERSION = 'v2.6.0';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
