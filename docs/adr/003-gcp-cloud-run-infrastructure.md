---
title: "ADR-003: GCP Cloud Run Infrastructure"
description: "Decision to deploy relay on Google Cloud Run with PostgreSQL storage"
category: reference
tags: ['adr', 'deployment', 'gcp', 'infrastructure', 'devops']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-003: GCP Cloud Run Infrastructure

## Status

Accepted

## Date

2024-02-01

## Context

Need hosting infrastructure for:
- Nostr relay (WebSocket server)
- Static frontend (SvelteKit)
- PostgreSQL database
- Image/file storage
- Serverless API endpoints

Requirements:
- Low operational overhead
- Auto-scaling capability
- Cost-effective for variable load
- WebSocket support

## Decision

Use Google Cloud Platform with Cloud Run as primary compute.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Run Services                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ nostr-relay  │  │ embedding-api│  │  image-api   │  │
│  │  (strfry)    │  │  (embeddings)│  │  (upload)    │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │  Cloud SQL   │                                       │
│  │ (PostgreSQL) │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Static Hosting                        │
├─────────────────────────────────────────────────────────┤
│  GitHub Pages: SvelteKit static build                   │
│  URL: https://dreamlab-ai.github.io/fairfield/          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Cloud Storage                         │
├─────────────────────────────────────────────────────────┤
│  nostr-bbs-vectors: HNSW index + embeddings             │
│  minimoonoir-images: User uploaded images               │
└─────────────────────────────────────────────────────────┘
```

### Service Configuration

| Service | Container | Min Instances | Max Instances |
|---------|-----------|---------------|---------------|
| nostr-relay | strfry | 1 | 10 |
| embedding-api | Node.js | 0 | 5 |
| image-api | Node.js | 0 | 5 |
| link-preview-api | Node.js | 0 | 3 |

### Database

```sql
-- Cloud SQL PostgreSQL 15
-- Primary tables
CREATE TABLE events (...);      -- Nostr events
CREATE TABLE access_control (...); -- Whitelist
CREATE TABLE rate_limits (...);    -- Rate limiting
```

## Consequences

### Positive
- Zero server management
- Auto-scaling to zero (cost savings)
- Native WebSocket support
- Integrated logging/monitoring
- Easy CI/CD with Cloud Build

### Negative
- Cold start latency (~2-5s)
- WebSocket connection limits
- Vendor lock-in to GCP
- Minimum 1 instance for relay (cost)

### Neutral
- PostgreSQL vs LMDB trade-off
- Static hosting external (GitHub Pages)

## Alternatives Considered

### Cloudflare Workers + Durable Objects
- Better edge performance
- Rejected: WebSocket limitations, D1 immaturity

### AWS Lambda + RDS
- Mature ecosystem
- Rejected: Higher complexity, cost

### Self-hosted VPS
- Full control
- Rejected: Operational overhead

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- Related: ADR-008 (PostgreSQL storage)
- Deployment: `services/nostr-relay/`
