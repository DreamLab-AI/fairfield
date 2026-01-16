/**
 * SvelteKit Server Hooks
 *
 * Provides server-side route protection and security logging.
 * Note: Since this is a static site adapter, most logic runs client-side.
 * These hooks provide defense-in-depth for SSR scenarios.
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Protected routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/admin',
  '/chat',
  '/dm',
  '/events',
  '/settings'
];

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/admin'
];

/**
 * Security event logger
 */
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    type: 'security',
    event,
    timestamp,
    ...details
  }));
}

export const handle: Handle = async ({ event, resolve }) => {
  const { url, request } = event;
  const pathname = url.pathname;

  // Log security-relevant requests
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    logSecurityEvent('protected_route_access', {
      path: pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
      referer: request.headers.get('referer')
    });
  }

  // Log admin route access attempts (skip during prerendering)
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    let clientIp = 'unknown';
    try {
      // getClientAddress throws during prerendering
      clientIp = event.getClientAddress();
    } catch {
      // Prerendering - no client address available
    }

    logSecurityEvent('admin_route_access', {
      path: pathname,
      method: request.method,
      ip: clientIp
    });
  }

  // Add security headers to response
  const response = await resolve(event);

  // Clone response to add headers
  const headers = new Headers(response.headers);

  // Ensure security headers are set (backup to static _headers)
  // HSTS: Enforce HTTPS for 1 year, include subdomains, allow preload
  if (!headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  if (!headers.has('X-Frame-Options')) {
    headers.set('X-Frame-Options', 'DENY');
  }
  if (!headers.has('X-Content-Type-Options')) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  // XSS Protection - set to 0 as CSP supersedes it (modern recommendation)
  if (!headers.has('X-XSS-Protection')) {
    headers.set('X-XSS-Protection', '0');
  }
  // Permissions Policy (formerly Feature-Policy)
  if (!headers.has('Permissions-Policy')) {
    headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  }
  // Content Security Policy - allows Nostr relay connections
  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'strict-dynamic'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' wss: ws: https:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; '));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
