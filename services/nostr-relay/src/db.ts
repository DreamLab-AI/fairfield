import { Pool, PoolClient } from 'pg';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export class NostrDatabase {
  private pool: Pool | null = null;

  constructor() {
    // Connection will be established in init()
  }

  async init(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      // Create events table and indexes
      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          pubkey TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          kind INTEGER NOT NULL,
          tags JSONB NOT NULL,
          content TEXT NOT NULL,
          sig TEXT NOT NULL,
          received_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kind ON events(kind)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_kind_created ON events(kind, created_at DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_tags ON events USING GIN(tags)`);

      // Create whitelist table for cohort management
      await client.query(`
        CREATE TABLE IF NOT EXISTS whitelist (
          pubkey TEXT PRIMARY KEY,
          cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,
          added_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
          added_by TEXT,
          expires_at BIGINT,
          notes TEXT
        )
      `);

      await client.query(`CREATE INDEX IF NOT EXISTS idx_whitelist_cohorts ON whitelist USING GIN(cohorts)`);
    } finally {
      client.release();
    }
  }

  async saveEvent(
    event: NostrEvent,
    options?: {
      treatment?: 'regular' | 'replaceable' | 'ephemeral' | 'parameterized_replaceable';
      replacementKey?: string | null;
      dTag?: string | null;
    }
  ): Promise<boolean> {
    if (!this.pool) return false;

    const treatment = options?.treatment || 'regular';

    try {
      // NIP-16: Handle replaceable events
      if (treatment === 'replaceable') {
        // Delete older event with same pubkey+kind
        await this.pool.query(
          `DELETE FROM events WHERE pubkey = $1 AND kind = $2 AND created_at < $3`,
          [event.pubkey, event.kind, event.created_at]
        );

        // Check if newer event exists
        const checkResult = await this.pool.query(
          `SELECT 1 FROM events WHERE pubkey = $1 AND kind = $2 AND created_at >= $3 LIMIT 1`,
          [event.pubkey, event.kind, event.created_at]
        );
        if (checkResult.rows.length > 0) {
          // Newer event exists, don't insert
          return false;
        }
      }

      // NIP-33: Handle parameterized replaceable events
      if (treatment === 'parameterized_replaceable') {
        const dTag = options?.dTag || '';

        // Delete older event with same pubkey+kind+d-tag using JSONB containment
        await this.pool.query(
          `DELETE FROM events
           WHERE pubkey = $1 AND kind = $2 AND created_at < $3
           AND tags @> $4::jsonb`,
          [event.pubkey, event.kind, event.created_at, JSON.stringify([['d', dTag]])]
        );

        // Check if newer event exists
        const checkResult = await this.pool.query(
          `SELECT 1 FROM events
           WHERE pubkey = $1 AND kind = $2 AND created_at >= $3
           AND tags @> $4::jsonb
           LIMIT 1`,
          [event.pubkey, event.kind, event.created_at, JSON.stringify([['d', dTag]])]
        );
        if (checkResult.rows.length > 0) {
          return false;
        }
      }

      const result = await this.pool.query(
        `INSERT INTO events (id, pubkey, created_at, kind, tags, content, sig)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig
        ]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async queryEvents(filters: any[]): Promise<NostrEvent[]> {
    if (!this.pool || !filters || filters.length === 0) {
      return [];
    }

    const events: NostrEvent[] = [];

    for (const filter of filters) {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filter.ids && filter.ids.length > 0) {
        const placeholders = filter.ids.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`id IN (${placeholders})`);
        params.push(...filter.ids);
      }

      if (filter.authors && filter.authors.length > 0) {
        const placeholders = filter.authors.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`pubkey IN (${placeholders})`);
        params.push(...filter.authors);
      }

      if (filter.kinds && filter.kinds.length > 0) {
        const placeholders = filter.kinds.map(() => `$${paramIndex++}`).join(',');
        conditions.push(`kind IN (${placeholders})`);
        params.push(...filter.kinds);
      }

      if (filter.since) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(filter.since);
      }

      if (filter.until) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(filter.until);
      }

      // Filter by tags using JSONB containment (e.g., #e, #p)
      for (const [key, values] of Object.entries(filter)) {
        if (key.startsWith('#') && Array.isArray(values)) {
          const tagName = key.substring(1);

          if (!/^[a-zA-Z0-9_-]+$/.test(tagName)) {
            continue;
          }

          for (const value of values) {
            if (typeof value !== 'string' || value.length === 0) {
              continue;
            }

            // Use JSONB containment operator for tag filtering
            conditions.push(`tags @> $${paramIndex++}::jsonb`);
            params.push(JSON.stringify([[tagName, value]]));
          }
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter.limit ? Math.min(filter.limit, 5000) : 500;

      const query = `
        SELECT id, pubkey, created_at, kind, tags, content, sig
        FROM events
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      try {
        const result = await this.pool.query(query, params);

        for (const row of result.rows) {
          events.push({
            id: row.id,
            pubkey: row.pubkey,
            created_at: Number(row.created_at),
            kind: row.kind,
            tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
            content: row.content,
            sig: row.sig,
          });
        }
      } catch {
        // Query failed, continue with other filters
      }
    }

    return events;
  }

  // Whitelist management methods
  async isWhitelisted(pubkey: string): Promise<boolean> {
    if (!this.pool) return false;

    const result = await this.pool.query(
      `SELECT 1 FROM whitelist
       WHERE pubkey = $1
       AND (expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT)`,
      [pubkey]
    );

    return result.rows.length > 0;
  }

  async getWhitelistEntry(pubkey: string): Promise<{
    pubkey: string;
    cohorts: string[];
    addedAt: number;
    addedBy: string | null;
    expiresAt: number | null;
    notes: string | null;
  } | null> {
    if (!this.pool) return null;

    const result = await this.pool.query(
      `SELECT pubkey, cohorts, added_at, added_by, expires_at, notes
       FROM whitelist
       WHERE pubkey = $1
       AND (expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT)`,
      [pubkey]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      pubkey: row.pubkey,
      cohorts: typeof row.cohorts === 'string' ? JSON.parse(row.cohorts) : (row.cohorts || []),
      addedAt: Number(row.added_at),
      addedBy: row.added_by,
      expiresAt: row.expires_at ? Number(row.expires_at) : null,
      notes: row.notes,
    };
  }

  async addToWhitelist(
    pubkey: string,
    cohorts: string[],
    addedBy: string,
    expiresAt?: number,
    notes?: string
  ): Promise<boolean> {
    if (!this.pool) return false;

    try {
      await this.pool.query(
        `INSERT INTO whitelist (pubkey, cohorts, added_by, expires_at, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (pubkey) DO UPDATE SET
           cohorts = EXCLUDED.cohorts,
           added_by = EXCLUDED.added_by,
           expires_at = EXCLUDED.expires_at,
           notes = EXCLUDED.notes`,
        [pubkey, JSON.stringify(cohorts), addedBy, expiresAt || null, notes || null]
      );
      return true;
    } catch {
      return false;
    }
  }

  async removeFromWhitelist(pubkey: string): Promise<boolean> {
    if (!this.pool) return false;

    try {
      await this.pool.query('DELETE FROM whitelist WHERE pubkey = $1', [pubkey]);
      return true;
    } catch {
      return false;
    }
  }

  async listWhitelist(): Promise<string[]> {
    if (!this.pool) return [];

    const result = await this.pool.query(
      `SELECT pubkey FROM whitelist
       WHERE expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT`
    );

    return result.rows.map(r => r.pubkey);
  }

  async listWhitelistPaginated(options?: {
    limit?: number;
    offset?: number;
    cohort?: string;
  }): Promise<{
    users: Array<{
      pubkey: string;
      cohorts: string[];
      addedAt: number;
      addedBy: string | null;
      displayName: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    if (!this.pool) {
      return { users: [], total: 0, limit: 20, offset: 0 };
    }

    const limit = Math.min(options?.limit || 20, 100);
    const offset = options?.offset || 0;

    try {
      // Build base conditions
      const conditions: string[] = [
        '(w.expires_at IS NULL OR w.expires_at > EXTRACT(EPOCH FROM NOW())::BIGINT)'
      ];
      const params: any[] = [];
      let paramIndex = 1;

      if (options?.cohort) {
        conditions.push(`w.cohorts @> $${paramIndex}::jsonb`);
        params.push(JSON.stringify([options.cohort]));
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM whitelist w ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0].count);

      // Get paginated users with optional profile data from events
      params.push(limit, offset);
      const result = await this.pool.query(
        `SELECT
          w.pubkey,
          w.cohorts,
          w.added_at,
          w.added_by,
          (
            SELECT e.content
            FROM events e
            WHERE e.pubkey = w.pubkey AND e.kind = 0
            ORDER BY e.created_at DESC
            LIMIT 1
          ) as profile_content
        FROM whitelist w
        ${whereClause}
        ORDER BY w.added_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      const users = result.rows.map(row => {
        let displayName: string | null = null;

        // Try to parse profile content to get display name
        if (row.profile_content) {
          try {
            const profile = JSON.parse(row.profile_content);
            displayName = profile.display_name || profile.name || null;
          } catch {
            // Invalid JSON, ignore
          }
        }

        return {
          pubkey: row.pubkey,
          cohorts: typeof row.cohorts === 'string' ? JSON.parse(row.cohorts) : (row.cohorts || []),
          addedAt: Number(row.added_at),
          addedBy: row.added_by,
          displayName
        };
      });

      return { users, total, limit, offset };
    } catch (error) {
      console.error('[DB] listWhitelistPaginated error:', error);
      return { users: [], total: 0, limit, offset };
    }
  }

  async getStats(): Promise<{
    eventCount: number;
    whitelistCount: number;
    dbSizeBytes: number;
  }> {
    if (!this.pool) {
      return { eventCount: 0, whitelistCount: 0, dbSizeBytes: 0 };
    }

    const eventResult = await this.pool.query('SELECT COUNT(*) as count FROM events');
    const whitelistResult = await this.pool.query('SELECT COUNT(*) as count FROM whitelist');

    // Get database size from PostgreSQL
    const sizeResult = await this.pool.query(
      `SELECT pg_database_size(current_database()) as size`
    );

    return {
      eventCount: Number(eventResult.rows[0].count),
      whitelistCount: Number(whitelistResult.rows[0].count),
      dbSizeBytes: Number(sizeResult.rows[0].size),
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Export alias for backward compatibility
export { NostrDatabase as Database };
