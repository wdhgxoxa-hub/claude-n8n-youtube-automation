import type { NextConfig } from 'next';
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://lh3.googleusercontent.com", "font-src 'self'", "connect-src 'self'", "media-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self' https://accounts.google.com"].join('; ');
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'Content-Security-Policy', value: csp }, { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
  ] }]; }
};
export default config;
