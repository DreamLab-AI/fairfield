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

    // List all whitelisted users (admin only)
    if (url.pathname === '/api/whitelist/list' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const cohortFilter = url.searchParams.get('cohort') || undefined;

      try {
        const result = await this.db.listWhitelistFull({ limit, offset, cohortFilter });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          users: result.users,
          total: result.total,
          limit,
          offset
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list users' }));
      }
      return;
    }

    // Add user to whitelist
    if (url.pathname === '/api/whitelist/add' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      await new Promise<void>(resolve => req.on('end', resolve));

      try {
        const data = JSON.parse(body);
        const { pubkey, cohorts, adminPubkey } = data;

        if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid pubkey format' }));
          return;
        }

        const success = await this.db.addToWhitelist(
          pubkey,
          cohorts || ['approved'],
          adminPubkey || 'system'
        );

        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to add user' }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
      return;
    }

    // Update user cohorts
    if (url.pathname === '/api/whitelist/update-cohorts' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      await new Promise<void>(resolve => req.on('end', resolve));

      try {
        const data = JSON.parse(body);
        const { pubkey, cohorts, adminPubkey } = data;

        if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid pubkey format' }));
          return;
        }

        if (!Array.isArray(cohorts)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Cohorts must be an array' }));
          return;
        }

        const success = await this.db.updateCohorts(pubkey, cohorts, adminPubkey || 'system');

        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to update cohorts' }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
      return;
    }

    // Relay info (NIP-11)
    if (url.pathname === '/.well-known/nostr.json' ||
        (req.headers.accept?.includes('application/nostr+json'))) {
      res.writeHead(200, { 'Content-Type': 'application/nostr+json' });
      res.end(JSON.stringify({
        name: 'Fairfield Nostr Relay',
        description: 'Private whitelist-only relay with NIP-16/98 support',
        pubkey: process.env.ADMIN_PUBKEYS?.split(',')[0] || '',
        supported_nips: [1, 11, 16, 33, 98],
        software: 'fairfield-nostr-relay',
        version: '2.3.0',
        limitation: {
          auth_required: false,
          payment_required: false,
          restricted_writes: true
        }
      }));
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
