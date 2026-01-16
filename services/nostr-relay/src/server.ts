import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { NostrDatabase } from './db';
import { Whitelist } from './whitelist';
import { RateLimiter } from './rateLimit';
import { NostrHandlers } from './handlers';
import { hasNostrAuth, verifyNostrAuth, pubkeyToDidNostr } from './nip98';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';

type ExtendedWebSocket = WebSocket & {
  ip?: string;
};

class NostrRelay {
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private db: NostrDatabase;
  private whitelist: Whitelist;
  private rateLimiter: RateLimiter;
  private handlers: NostrHandlers;

  constructor() {
    this.db = new NostrDatabase();
    this.whitelist = new Whitelist();
    this.rateLimiter = new RateLimiter();
    this.handlers = new NostrHandlers(this.db, this.whitelist, this.rateLimiter);

    // Create HTTP server for REST endpoints
    this.server = createServer((req, res) => this.handleHttpRequest(req, res));

    // Attach WebSocket server to HTTP server
    this.wss = new WebSocketServer({ server: this.server });
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Security headers - HSTS enforcement for Cloud Run
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      const stats = await this.db.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        version: '2.3.0',
        database: 'postgresql',
        events: stats.eventCount,
        whitelisted: stats.whitelistCount,
        dbSizeBytes: stats.dbSizeBytes,
        uptime: process.uptime(),
        nips: [1, 11, 16, 33, 98]
      }));
      return;
    }

    // Whitelist check endpoint
    if (url.pathname === '/api/check-whitelist') {
      const pubkey = url.searchParams.get('pubkey');

      if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid pubkey format' }));
        return;
      }

      // Check environment whitelist first (backward compatible)
      const isEnvWhitelisted = this.whitelist.isAllowed(pubkey);

      // Check database whitelist
      const dbEntry = await this.db.getWhitelistEntry(pubkey);

      // Check if admin
      const adminPubkeys = (process.env.ADMIN_PUBKEYS || process.env.WHITELIST_PUBKEYS || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      const isAdmin = adminPubkeys.includes(pubkey);

      const cohorts = dbEntry?.cohorts || [];
      if (isAdmin && !cohorts.includes('admin')) {
        cohorts.push('admin');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        isWhitelisted: isEnvWhitelisted || !!dbEntry,
        isAdmin,
        cohorts,
        verifiedAt: Date.now(),
        source: 'relay'
      }));
      return;
    }

    // NIP-98 authenticated endpoint example
    if (url.pathname === '/api/authenticated') {
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = value;
      }

      if (!hasNostrAuth(headers)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'NIP-98 authentication required' }));
        return;
      }

      const authResult = await verifyNostrAuth({
        method: req.method || 'GET',
        url: req.url || '/',
        headers,
        protocol: 'http',
        hostname: req.headers.host
      });

      if (authResult.error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: authResult.error }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        authenticated: true,
        pubkey: authResult.pubkey,
        didNostr: authResult.didNostr
      }));
      return;
    }

    // Relay info (NIP-11)
    // Responds to Accept: application/nostr+json header OR direct path access
    if (url.pathname === '/' && req.headers.accept?.includes('application/nostr+json')) {
      const relayInfo = this.buildNip11Info();
      res.writeHead(200, { 'Content-Type': 'application/nostr+json' });
      res.end(JSON.stringify(relayInfo));
      return;
    }

    // ========================================================================
    // Admin Whitelist Management APIs
    // ========================================================================

    // Helper to check if pubkey is admin
    const isAdminPubkey = (pubkey: string): boolean => {
      const adminPubkeys = (process.env.ADMIN_PUBKEYS || process.env.WHITELIST_PUBKEYS || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      return adminPubkeys.includes(pubkey);
    };

    // Helper to read JSON body
    const readJsonBody = async (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
        req.on('error', reject);
      });
    };

    // List whitelisted users (paginated)
    if (url.pathname === '/api/whitelist/list' && req.method === 'GET') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const cohort = url.searchParams.get('cohort') || undefined;

        const result = await this.db.listWhitelistPaginated({ limit, offset, cohort });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('[API] /api/whitelist/list error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // Add user to whitelist
    if (url.pathname === '/api/whitelist/add' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { pubkey, cohorts, adminPubkey } = body;

        // Validate required fields
        if (!pubkey || !adminPubkey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pubkey or adminPubkey' }));
          return;
        }

        // Verify admin authorization
        if (!isAdminPubkey(adminPubkey)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not authorized' }));
          return;
        }

        // Add to whitelist
        const success = await this.db.addToWhitelist(
          pubkey,
          cohorts || ['approved'],
          adminPubkey
        );

        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to add user' }));
        }
      } catch (error) {
        console.error('[API] /api/whitelist/add error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // Update user cohorts
    if (url.pathname === '/api/whitelist/update-cohorts' && req.method === 'POST') {
      try {
        const body = await readJsonBody();
        const { pubkey, cohorts, adminPubkey } = body;

        // Validate required fields
        if (!pubkey || !cohorts || !adminPubkey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing pubkey, cohorts, or adminPubkey' }));
          return;
        }

        // Verify admin authorization
        if (!isAdminPubkey(adminPubkey)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not authorized' }));
          return;
        }

        // Update cohorts (uses addToWhitelist which has ON CONFLICT UPDATE)
        const success = await this.db.addToWhitelist(
          pubkey,
          cohorts,
          adminPubkey
        );

        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to update cohorts' }));
        }
      } catch (error) {
        console.error('[API] /api/whitelist/update-cohorts error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Build NIP-11 Relay Information Document
   * https://github.com/nostr-protocol/nips/blob/master/11.md
   *
   * Per NIP-11 spec (2025):
   * - All fields are optional; clients must ignore unknown fields
   * - Retention times in seconds, null indicates indefinite storage
   * - Kind ranges can use tuples like [5, 7] for inclusive boundaries
   */
  private buildNip11Info(): object {
    const adminPubkey = process.env.ADMIN_PUBKEYS?.split(',')[0]?.trim() || '';
    const relayName = process.env.RELAY_NAME || 'Fairfield Nostr Relay';
    const relayDescription = process.env.RELAY_DESCRIPTION ||
      'Private whitelist-only relay for the Fairfield BBS community.\n\n' +
      'Supports NIP-01 (basic protocol), NIP-11 (relay info), NIP-16 (replaceable events), ' +
      'NIP-33 (parameterized replaceable events), and NIP-98 (HTTP auth).\n\n' +
      'Write access is restricted to whitelisted pubkeys. Registration requests (kind 9024) ' +
      'and profile metadata (kind 0) are accepted from anyone to support the onboarding flow.';
    const relayContact = process.env.RELAY_CONTACT || (adminPubkey ? `nostr:${adminPubkey}` : '');
    const baseUrl = process.env.RELAY_BASE_URL || 'https://fairfield.dev';

    // Limits from handlers.ts and rateLimit.ts
    const maxContentLength = 64 * 1024; // 64KB
    const maxTagCount = 2000;
    const maxTimestampDrift = 60 * 60 * 24 * 7; // 7 days in seconds
    const maxSubscriptions = 20; // Reasonable default
    const maxFilters = 10; // Per subscription
    const maxLimit = 1000; // Query result limit
    const eventsPerSecond = parseInt(process.env.RATE_LIMIT_EVENTS_PER_SECOND || '10', 10);
    const maxConnections = parseInt(process.env.RATE_LIMIT_MAX_CONNECTIONS || '20', 10);

    return {
      // Core identity fields
      name: relayName,
      description: relayDescription,
      pubkey: adminPubkey,
      contact: relayContact,

      // Software identification
      supported_nips: [1, 11, 16, 33, 98],
      software: 'https://github.com/fairfield-programming/nostr-relay',
      version: '2.3.0',

      // Visual branding
      icon: `${baseUrl}/favicon.png`,
      banner: `${baseUrl}/relay-banner.png`,

      // Limitations per NIP-11 specification
      limitation: {
        // Message and content constraints
        max_message_length: maxContentLength,
        max_content_length: maxContentLength,
        max_event_tags: maxTagCount,

        // Subscription constraints
        max_subscriptions: maxSubscriptions,
        max_filters: maxFilters,
        max_limit: maxLimit,
        max_subid_length: 64,

        // Rate limiting
        max_events_per_second: eventsPerSecond,
        max_connections: maxConnections,

        // Proof of work (0 = not required)
        min_pow_difficulty: 0,

        // Access control
        auth_required: false,
        payment_required: false,
        restricted_writes: true,

        // Timestamp bounds (events outside this range are rejected)
        created_at_lower_limit: Math.floor(Date.now() / 1000) - maxTimestampDrift,
        created_at_upper_limit: Math.floor(Date.now() / 1000) + maxTimestampDrift
      },

      // Relay policies and legal
      relay_countries: ['US'],
      language_tags: ['en'],
      tags: ['community', 'private', 'whitelisted'],
      posting_policy: `${baseUrl}/relay-policy`,
      privacy_policy: `${baseUrl}/privacy`,
      terms_of_service: `${baseUrl}/terms`,

      // Data retention (time in seconds, null = indefinite)
      // Per NIP-11: kind ranges can use tuples [min, max] inclusive
      retention: [
        { kinds: [0], time: null },          // Profile metadata: indefinite
        { kinds: [3], time: null },          // Contact lists: indefinite
        { kinds: [1], time: 7776000 },       // Notes: 90 days
        { kinds: [7], time: 2592000 },       // Reactions: 30 days
        { kinds: [4], time: 604800 },        // Legacy DMs (NIP-04): 7 days
        { kinds: [1059], time: 604800 },     // Gift wraps (NIP-59): 7 days
        { kinds: [9024], time: 86400 },      // Registration requests: 1 day
        { kinds: [[10000, 19999]], time: null }, // Replaceable events: indefinite
        { kinds: [[30000, 39999]], time: null }  // Parameterized replaceable: indefinite
      ]
    };
  }

  async start(): Promise<void> {
    await this.db.init();

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      const ip = this.extractIP(req);

      if (!this.handlers.trackConnection(ws, ip)) {
        ws.close(1008, 'rate limit exceeded: too many concurrent connections');
        return;
      }

      ws.on('message', async (data: Buffer) => {
        const message = data.toString();
        await this.handlers.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.handlers.handleDisconnect(ws);
      });

      ws.on('error', () => {
        // Connection error handled by close event
      });
    });

    this.server.listen(PORT, HOST);
  }

  private extractIP(req: IncomingMessage): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    return req.socket.remoteAddress || 'unknown';
  }

  async stop(): Promise<void> {
    this.wss.close();
    this.server.close();
    this.rateLimiter.destroy();
    await this.db.close();
  }
}

const relay = new NostrRelay();

relay.start().catch(() => {
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await relay.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await relay.stop();
  process.exit(0);
});
