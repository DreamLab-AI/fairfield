/**
 * Link Preview API - Cloud Run Service
 * Proxies requests to fetch OpenGraph metadata, bypassing CORS
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');
const TIMEOUT_MS = 10000;
const TWITTER_OEMBED_URL = 'https://publish.twitter.com/oembed';

// In-memory cache
const previewCache = new Map();
const CACHE_MAX_AGE = 10 * 24 * 60 * 60 * 1000; // 10 days
const TWITTER_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day
const MAX_CACHE_SIZE = 1000;

await fastify.register(cors, {
  origin: ALLOWED_ORIGINS[0] === '*' ? true : ALLOWED_ORIGINS,
  methods: ['GET', 'OPTIONS']
});

function isTwitterUrl(url) {
  try {
    const parsed = new URL(url);
    return ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com', 'mobile.twitter.com', 'mobile.x.com'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function getCachedPreview(url, isTwitter) {
  const entry = previewCache.get(url);
  if (!entry) return null;

  const maxAge = isTwitter ? TWITTER_CACHE_MAX_AGE : CACHE_MAX_AGE;
  if (Date.now() - entry.timestamp > maxAge) {
    previewCache.delete(url);
    return null;
  }

  entry.hits++;
  return entry.data;
}

function setCachedPreview(url, data) {
  if (previewCache.size >= MAX_CACHE_SIZE) {
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
    hits: 0
  });
}

function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' '
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }

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

function resolveUrl(relativeUrl, baseUrl) {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

function parseOpenGraphTags(html, url) {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const preview = {
    url,
    domain,
    favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  };

  const extractMeta = (pattern) => {
    const match = html.match(pattern);
    return match ? decodeHtmlEntities(match[1]) : undefined;
  };

  preview.title = extractMeta(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
    || extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)
    || extractMeta(/<title>([^<]+)<\/title>/i);

  preview.description = extractMeta(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
    || extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
    || extractMeta(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

  const imageUrl = extractMeta(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || extractMeta(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (imageUrl) {
    preview.image = resolveUrl(imageUrl, url);
  }

  preview.siteName = extractMeta(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);

  return preview;
}

async function fetchTwitterEmbed(url) {
  const oembedUrl = new URL(TWITTER_OEMBED_URL);
  oembedUrl.searchParams.set('url', url);
  oembedUrl.searchParams.set('omit_script', 'true');
  oembedUrl.searchParams.set('dnt', 'true');
  oembedUrl.searchParams.set('theme', 'dark');

  const response = await fetch(oembedUrl.toString(), {
    headers: { 'Accept': 'application/json', 'User-Agent': 'LinkPreviewAPI/1.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) throw new Error(`Twitter oEmbed failed: ${response.status}`);

  const data = await response.json();
  return {
    type: 'twitter',
    url,
    html: data.html,
    author_name: data.author_name,
    author_url: data.author_url,
    provider_name: data.provider_name || 'X'
  };
}

async function fetchOpenGraphData(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'LinkPreviewAPI/1.0 (Link Preview Bot)'
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow'
  });

  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

  const html = await response.text();
  return { type: 'opengraph', ...parseOpenGraphTags(html, url) };
}

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'link-preview-api',
  cacheSize: previewCache.size
}));

// Cache stats
fastify.get('/stats', async () => {
  let totalHits = 0;
  for (const entry of previewCache.values()) {
    totalHits += entry.hits;
  }
  return { size: previewCache.size, totalHits };
});

// Main preview endpoint
fastify.get('/preview', async (request, reply) => {
  const targetUrl = request.query.url;

  if (!targetUrl) {
    return reply.code(400).send({ error: 'Missing url parameter' });
  }

  try {
    new URL(targetUrl);
  } catch {
    return reply.code(400).send({ error: 'Invalid URL' });
  }

  const isTwitter = isTwitterUrl(targetUrl);

  const cached = getCachedPreview(targetUrl, isTwitter);
  if (cached) {
    reply.header('X-Cache', 'HIT');
    return { ...cached, cached: true };
  }

  try {
    let data;
    if (isTwitter) {
      data = await fetchTwitterEmbed(targetUrl);
    } else {
      data = await fetchOpenGraphData(targetUrl);
    }

    setCachedPreview(targetUrl, data);
    reply.header('X-Cache', 'MISS');
    return { ...data, cached: false };
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }
});

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`Link Preview API listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
