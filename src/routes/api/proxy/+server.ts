/**
 * Link Preview Proxy Endpoint
 *
 * Proxies requests to external URLs to bypass CORS and fetch OpenGraph metadata.
 * Special handling for Twitter/X to use their oEmbed API for rich previews.
 *
 * Features:
 * - Server-side caching to reduce load on external services
 * - Twitter/X oEmbed support for rich tweet previews
 * - Shared cache across all users on the node
 *
 * Security:
 * - URL allowlist for trusted domains only
 * - HTTPS-only scheme validation
 * - Private/internal IP blocking
 * - Rate limiting structure (TODO: implement with Redis)
 */

import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

const TWITTER_OEMBED_URL = 'https://publish.twitter.com/oembed';
const TIMEOUT_MS = 10000;

// =============================================================================
// SECURITY: URL Allowlist Configuration
// =============================================================================

/**
 * Allowlist of trusted domains for link previews.
 * Only URLs from these domains (and their subdomains) will be fetched.
 */
const ALLOWED_DOMAINS = new Set([
	// Social media
	'twitter.com',
	'x.com',
	'youtube.com',
	'youtu.be',
	'github.com',
	'reddit.com',
	'instagram.com',
	'facebook.com',
	'linkedin.com',
	'tiktok.com',
	'threads.net',
	'mastodon.social',
	'bsky.app',

	// Media & News
	'medium.com',
	'substack.com',
	'nytimes.com',
	'washingtonpost.com',
	'bbc.com',
	'bbc.co.uk',
	'theguardian.com',
	'reuters.com',
	'apnews.com',
	'cnn.com',
	'npr.org',

	// Tech & Developer
	'stackoverflow.com',
	'stackexchange.com',
	'dev.to',
	'hashnode.com',
	'hackernews.com',
	'news.ycombinator.com',
	'gitlab.com',
	'bitbucket.org',
	'codepen.io',
	'codesandbox.io',
	'replit.com',
	'npmjs.com',
	'pypi.org',
	'crates.io',

	// Documentation & Reference
	'wikipedia.org',
	'wikimedia.org',
	'docs.google.com',
	'notion.so',
	'notion.site',

	// Images & Media Hosting
	'imgur.com',
	'giphy.com',
	'tenor.com',
	'vimeo.com',
	'twitch.tv',
	'soundcloud.com',
	'spotify.com',

	// Nostr-related
	'nostr.build',
	'nostr.band',
	'snort.social',
	'primal.net',
	'iris.to',
	'nostrudel.ninja',
]);

/**
 * Private/internal IP ranges that must be blocked to prevent SSRF attacks.
 * Includes IPv4 and IPv6 private ranges.
 */
const BLOCKED_IP_PATTERNS = [
	// IPv4 loopback
	/^127\./,
	// IPv4 private ranges (RFC 1918)
	/^10\./,
	/^192\.168\./,
	/^172\.(1[6-9]|2[0-9]|3[0-1])\./,
	// IPv4 link-local
	/^169\.254\./,
	// IPv4 localhost alternatives
	/^0\./,
	// IPv6 loopback
	/^::1$/,
	/^0:0:0:0:0:0:0:1$/,
	// IPv6 private ranges
	/^fc[0-9a-f]{2}:/i,
	/^fd[0-9a-f]{2}:/i,
	// IPv6 link-local
	/^fe80:/i,
	// AWS metadata endpoint
	/^169\.254\.169\.254$/,
	// Cloud metadata endpoints (GCP, Azure)
	/^metadata\./i,
];

const BLOCKED_HOSTNAMES = new Set([
	'localhost',
	'localhost.localdomain',
	'local',
	'internal',
	'intranet',
	'metadata',
	'metadata.google.internal',
	'169.254.169.254',
]);

// =============================================================================
// RATE LIMITING STRUCTURE (Future Implementation)
// =============================================================================

/**
 * Rate limiting configuration - to be implemented with Redis or similar.
 *
 * TODO: Implement rate limiting with the following structure:
 *
 * interface RateLimitConfig {
 *   windowMs: number;        // Time window in milliseconds
 *   maxRequests: number;     // Max requests per window
 *   keyGenerator: (ip: string, url: string) => string;
 * }
 *
 * const RATE_LIMITS = {
 *   perIP: { windowMs: 60000, maxRequests: 30 },      // 30 req/min per IP
 *   perDomain: { windowMs: 60000, maxRequests: 100 }, // 100 req/min per domain
 *   global: { windowMs: 60000, maxRequests: 1000 },   // 1000 req/min global
 * };
 *
 * Implementation notes:
 * - Use Redis INCR with EXPIRE for atomic rate limiting
 * - Return 429 Too Many Requests when limit exceeded
 * - Include Retry-After header with remaining window time
 * - Consider using sliding window algorithm for smoother limiting
 */

// =============================================================================
// Cache Implementation
// =============================================================================

interface CacheEntry {
	data: Record<string, unknown>;
	timestamp: number;
	hits: number;
}

const previewCache = new Map<string, CacheEntry>();
const CACHE_MAX_AGE = 10 * 24 * 60 * 60 * 1000; // 10 days
const TWITTER_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day for Twitter (more dynamic content)
const MAX_CACHE_SIZE = 1000;

/**
 * Get cached preview if available and not expired
 */
function getCachedPreview(url: string, isTwitter: boolean): Record<string, unknown> | null {
	const entry = previewCache.get(url);
	if (!entry) return null;

	const maxAge = isTwitter ? TWITTER_CACHE_MAX_AGE : CACHE_MAX_AGE;
	if (Date.now() - entry.timestamp > maxAge) {
		previewCache.delete(url);
		return null;
	}

	// Increment hit counter for analytics
	entry.hits++;
	return entry.data;
}

/**
 * Store preview in cache
 */
function setCachedPreview(url: string, data: Record<string, unknown>): void {
	// Enforce cache size limit (LRU-style: remove oldest entries)
	if (previewCache.size >= MAX_CACHE_SIZE) {
		// Remove oldest 10% of entries
		const entries = Array.from(previewCache.entries());
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
		const toRemove = Math.ceil(MAX_CACHE_SIZE * 0.1);
		for (let i = 0; i < toRemove; i++) {
			previewCache.delete(entries[i][0]);
		}
	}

	previewCache.set(url, {
		data,
		timestamp: Date.now(),
		hits: 0,
	});
}

/**
 * Get cache statistics
 */
function getCacheStats(): { size: number; totalHits: number } {
	let totalHits = 0;
	for (const entry of previewCache.values()) {
		totalHits += entry.hits;
	}
	return { size: previewCache.size, totalHits };
}

// =============================================================================
// Security Validation Functions
// =============================================================================

/**
 * Check if a domain is in the allowlist (including subdomains)
 */
function isDomainAllowed(hostname: string): boolean {
	const normalizedHost = hostname.toLowerCase();

	// Check exact match
	if (ALLOWED_DOMAINS.has(normalizedHost)) {
		return true;
	}

	// Check if it's a subdomain of an allowed domain
	for (const allowedDomain of ALLOWED_DOMAINS) {
		if (normalizedHost.endsWith(`.${allowedDomain}`)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if a hostname or IP is blocked (internal/private)
 */
function isBlockedHost(hostname: string): boolean {
	const normalizedHost = hostname.toLowerCase();

	// Check blocked hostnames
	if (BLOCKED_HOSTNAMES.has(normalizedHost)) {
		return true;
	}

	// Check blocked IP patterns
	for (const pattern of BLOCKED_IP_PATTERNS) {
		if (pattern.test(normalizedHost)) {
			return true;
		}
	}

	return false;
}

/**
 * Validate URL for SSRF protection
 * Returns an error message if validation fails, null if valid
 */
function validateUrlSecurity(urlString: string): string | null {
	let parsed: URL;

	try {
		parsed = new URL(urlString);
	} catch {
		return 'Invalid URL format';
	}

	// 1. Validate scheme - HTTPS only
	if (parsed.protocol !== 'https:') {
		return 'Only HTTPS URLs are allowed';
	}

	// 2. Check for blocked internal/private hosts
	if (isBlockedHost(parsed.hostname)) {
		return 'Access to internal/private addresses is not allowed';
	}

	// 3. Check domain allowlist
	if (!isDomainAllowed(parsed.hostname)) {
		return `Domain "${parsed.hostname}" is not in the allowlist`;
	}

	// 4. Block URLs with credentials
	if (parsed.username || parsed.password) {
		return 'URLs with credentials are not allowed';
	}

	// 5. Block non-standard ports (only allow 443 for HTTPS)
	if (parsed.port && parsed.port !== '443') {
		return 'Non-standard ports are not allowed';
	}

	return null;
}

// =============================================================================
// URL Type Detection
// =============================================================================

/**
 * Detect if URL is Twitter/X
 */
function isTwitterUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com', 'mobile.twitter.com', 'mobile.x.com'].includes(parsed.hostname);
	} catch {
		return false;
	}
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Fetch Twitter oEmbed data
 */
async function fetchTwitterEmbed(url: string): Promise<Response> {
	const oembedUrl = new URL(TWITTER_OEMBED_URL);
	oembedUrl.searchParams.set('url', url);
	oembedUrl.searchParams.set('omit_script', 'true');
	oembedUrl.searchParams.set('dnt', 'true'); // Do not track
	oembedUrl.searchParams.set('theme', 'dark'); // Request dark theme

	const response = await fetch(oembedUrl.toString(), {
		headers: {
			'Accept': 'application/json',
			'User-Agent': 'Nostr-BBS/1.0',
		},
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`Twitter oEmbed failed: ${response.status}`);
	}

	const data = await response.json();

	return new Response(JSON.stringify({
		type: 'twitter',
		url: url,
		html: data.html,
		author_name: data.author_name,
		author_url: data.author_url,
		provider_name: data.provider_name || 'X',
		width: data.width,
	}), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		},
	});
}

/**
 * Fetch generic OpenGraph metadata
 */
async function fetchOpenGraphData(url: string): Promise<Response> {
	const response = await fetch(url, {
		headers: {
			'Accept': 'text/html,application/xhtml+xml',
			'User-Agent': 'Nostr-BBS/1.0 (Link Preview Bot)',
		},
		signal: AbortSignal.timeout(TIMEOUT_MS),
		redirect: 'follow',
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch URL: ${response.status}`);
	}

	const html = await response.text();

	// Parse OpenGraph tags
	const preview = parseOpenGraphTags(html, url);

	return new Response(JSON.stringify({
		type: 'opengraph',
		...preview,
	}), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
		},
	});
}

/**
 * Parse OpenGraph tags from HTML
 */
function parseOpenGraphTags(html: string, url: string): Record<string, string | undefined> {
	const domain = new URL(url).hostname.replace(/^www\./, '');

	const preview: Record<string, string | undefined> = {
		url,
		domain,
		favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
	};

	// Helper to extract meta content
	const extractMeta = (pattern: RegExp): string | undefined => {
		const match = html.match(pattern);
		return match ? decodeHtmlEntities(match[1]) : undefined;
	};

	// Extract og:title (try multiple patterns)
	preview.title = extractMeta(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
		|| extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
		|| extractMeta(/<title>([^<]+)<\/title>/i);

	// Extract og:description
	preview.description = extractMeta(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
		|| extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
		|| extractMeta(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
		|| extractMeta(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

	// Extract og:image
	const imageUrl = extractMeta(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
		|| extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
	if (imageUrl) {
		preview.image = resolveUrl(imageUrl, url);
	}

	// Extract og:site_name
	preview.siteName = extractMeta(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
		|| extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:site_name["']/i);

	// Extract Twitter card data as fallback
	if (!preview.title) {
		preview.title = extractMeta(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
	}
	if (!preview.description) {
		preview.description = extractMeta(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
	}
	if (!preview.image) {
		const twitterImage = extractMeta(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
		if (twitterImage) {
			preview.image = resolveUrl(twitterImage, url);
		}
	}

	return preview;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&apos;': "'",
		'&nbsp;': ' ',
	};

	let decoded = text;
	for (const [entity, char] of Object.entries(entities)) {
		decoded = decoded.replace(new RegExp(entity, 'gi'), char);
	}

	// Handle numeric entities
	decoded = decoded.replace(/&#(\d+);/g, (_, num) => {
		const code = parseInt(num, 10);
		return code > 0 && code < 0x10FFFF ? String.fromCodePoint(code) : '';
	});

	decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
		const code = parseInt(hex, 16);
		return code > 0 && code < 0x10FFFF ? String.fromCodePoint(code) : '';
	});

	return decoded;
}

/**
 * Resolve relative URLs
 */
function resolveUrl(relativeUrl: string, baseUrl: string): string {
	try {
		return new URL(relativeUrl, baseUrl).href;
	} catch {
		return relativeUrl;
	}
}

// =============================================================================
// Request Handler
// =============================================================================

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const targetUrl = url.searchParams.get('url');
	const statsOnly = url.searchParams.get('stats') === 'true';

	// Return cache stats if requested (useful for monitoring)
	if (statsOnly) {
		return new Response(JSON.stringify(getCacheStats()), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!targetUrl) {
		return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// ==========================================================================
	// SECURITY VALIDATION
	// ==========================================================================

	const securityError = validateUrlSecurity(targetUrl);
	if (securityError) {
		return new Response(JSON.stringify({ error: securityError }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// ==========================================================================
	// RATE LIMITING (TODO: Implement with Redis)
	// ==========================================================================

	// TODO: Add rate limiting check here
	// const clientIP = getClientAddress();
	// const rateLimitResult = await checkRateLimit(clientIP, targetUrl);
	// if (rateLimitResult.exceeded) {
	//   return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
	//     status: 429,
	//     headers: {
	//       'Content-Type': 'application/json',
	//       'Retry-After': String(rateLimitResult.retryAfter),
	//     },
	//   });
	// }

	const isTwitter = isTwitterUrl(targetUrl);

	// Check server-side cache first
	const cached = getCachedPreview(targetUrl, isTwitter);
	if (cached) {
		return new Response(JSON.stringify({ ...cached, cached: true }), {
			headers: {
				'Content-Type': 'application/json',
				'X-Cache': 'HIT',
				'Cache-Control': isTwitter ? 'public, max-age=3600' : 'public, max-age=86400',
			},
		});
	}

	try {
		let data: Record<string, unknown>;

		// Special handling for Twitter/X
		if (isTwitter) {
			const response = await fetchTwitterEmbed(targetUrl);
			data = await response.json();
		} else {
			const response = await fetchOpenGraphData(targetUrl);
			data = await response.json();
		}

		// Store in server cache
		setCachedPreview(targetUrl, data);

		return new Response(JSON.stringify({ ...data, cached: false }), {
			headers: {
				'Content-Type': 'application/json',
				'X-Cache': 'MISS',
				'Cache-Control': isTwitter ? 'public, max-age=3600' : 'public, max-age=86400',
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
