---
title: "ADR-008: PostgreSQL Relay Storage"
description: "Decision to use PostgreSQL for relay event storage with strfry"
category: reference
tags: ['adr', 'database', 'postgresql', 'relay', 'storage']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-008: PostgreSQL Relay Storage

## Status

Accepted

## Date

2024-02-15

## Context

Nostr relay storage options:
- **LMDB**: Default for strfry, fast but single-node
- **PostgreSQL**: Relational, scalable, managed options
- **SQLite**: Simple but limited concurrency

Requirements:
- Reliable event storage
- Whitelist/access control queries
- Cloud-managed option (Cloud SQL)
- Backup and recovery
- Future scaling path

## Decision

Use PostgreSQL via Cloud SQL for relay storage backend.

### Schema

```sql
-- Core events table (NIP-01)
CREATE TABLE events (
  id TEXT PRIMARY KEY,              -- Event ID (sha256 hex)
  pubkey TEXT NOT NULL,             -- Author pubkey
  created_at BIGINT NOT NULL,       -- Unix timestamp
  kind INTEGER NOT NULL,            -- Event kind
  tags JSONB NOT NULL DEFAULT '[]', -- Event tags
  content TEXT NOT NULL,            -- Event content
  sig TEXT NOT NULL,                -- Schnorr signature

  -- Indexes
  CONSTRAINT valid_id CHECK (length(id) = 64),
  CONSTRAINT valid_pubkey CHECK (length(pubkey) = 64)
);

CREATE INDEX idx_events_pubkey ON events(pubkey);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_tags ON events USING GIN(tags);

-- Access control whitelist
CREATE TABLE access_control (
  pubkey TEXT PRIMARY KEY,
  cohorts TEXT[] NOT NULL DEFAULT '{}',
  access_level TEXT NOT NULL DEFAULT 'member',
  section_roles JSONB DEFAULT '{}',
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting
CREATE TABLE rate_limits (
  pubkey TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  event_count INTEGER DEFAULT 0,
  CONSTRAINT fk_pubkey FOREIGN KEY (pubkey)
    REFERENCES access_control(pubkey) ON DELETE CASCADE
);
```

### Strfry Configuration

```conf
# /etc/strfry/strfry.conf
db = "postgresql://user:pass@/cloudsql/PROJECT:REGION:INSTANCE/nostr_relay"

relay {
    info {
        name = "Nostr BBS Private Relay"
        description = "Whitelist-only community relay"
    }

    maxWebsocketPayloadKb = 256
    autoPingSeconds = 30

    writePolicy {
        plugin = "/app/scripts/whitelist-policy.js"
    }
}
```

### Query Patterns

```sql
-- Subscription query (NIP-01 filter)
SELECT * FROM events
WHERE kind = ANY($1)
  AND pubkey = ANY($2)
  AND created_at > $3
ORDER BY created_at DESC
LIMIT $4;

-- Tag query (e.g., replies to event)
SELECT * FROM events
WHERE tags @> '[["e", $1]]'::jsonb
ORDER BY created_at ASC;

-- Whitelist check
SELECT cohorts, access_level, section_roles
FROM access_control
WHERE pubkey = $1;
```

## Consequences

### Positive
- Managed service (Cloud SQL)
- Standard SQL queries
- JSONB for flexible tag queries
- Easy backup/restore
- Horizontal read scaling (replicas)

### Negative
- Higher latency than LMDB
- More expensive than local storage
- Connection pool management
- Cold start on serverless

### Neutral
- Different query patterns than strfry default
- Need custom write policy for whitelist

## Alternatives Considered

### LMDB (strfry default)
- Fastest for single node
- Rejected: No managed cloud option

### SQLite + Litestream
- Simple, cheap
- Rejected: Single-writer limitation

### CockroachDB
- Distributed SQL
- Rejected: Overkill, cost

## References

- [strfry](https://github.com/hoytech/strfry)
- [Cloud SQL](https://cloud.google.com/sql)
- Related: ADR-003 (GCP infrastructure)
- Schema: `services/nostr-relay/sql/schema.sql`
