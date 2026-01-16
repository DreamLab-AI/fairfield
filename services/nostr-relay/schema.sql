-- PostgreSQL schema for Nostr relay
-- REFERENCE ONLY - the database is created automatically by src/db.ts
--
-- Database: PostgreSQL 14+ (Cloud SQL recommended for production)
-- Driver: pg (node-postgres)
-- See: ADR-008 for database decision rationale

-- Core events table (NIP-01)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  kind INTEGER NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,  -- JSONB for GIN indexing
  content TEXT NOT NULL,
  sig TEXT NOT NULL,
  received_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes for query performance (NIP-01 filters)
CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kind_created ON events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags ON events USING GIN(tags);

-- Whitelist table for cohort management
CREATE TABLE IF NOT EXISTS whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  added_by TEXT,
  expires_at BIGINT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_whitelist_cohorts ON whitelist USING GIN(cohorts);

-- Implementation Notes:
-- - Uses JSONB for tags to enable efficient GIN-indexed containment queries
-- - Tag queries use: tags @> '[["tagname","value"]]'::jsonb
-- - Maximum 5000 events per query (limit enforced in db.ts)
-- - Connection pool: max 20 connections, 30s idle timeout
-- - For Cloud SQL: use Unix socket connection via ?host=/cloudsql/...
