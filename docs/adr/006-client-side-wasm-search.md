---
title: "ADR-006: Client-Side WASM Search"
description: "Decision to implement client-side semantic search using WASM and HNSW indexing"
category: reference
tags: ['adr', 'search', 'wasm', 'performance', 'pwa']
difficulty: advanced
last-updated: 2026-01-16
---

# ADR-006: Client-Side WASM Search

## Status

Accepted

## Date

2024-03-15

## Context

Semantic search requirements:
- Search across forum messages
- Natural language queries
- Fast response time
- Privacy (no server-side query logging)
- Offline capability

Server-side search would require:
- Additional infrastructure
- Query logging (privacy concern)
- Always-online requirement

## Decision

Implement client-side semantic search using WASM-compiled HNSW index.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Search Pipeline                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Index Build (Server - periodic)                     │
│     ├── Extract text from events                        │
│     ├── Generate embeddings (all-MiniLM-L6-v2)         │
│     ├── Build HNSW index                               │
│     └── Upload to GCS bucket                           │
│                                                         │
│  2. Index Sync (Client - WiFi only)                    │
│     ├── Check for index updates                        │
│     ├── Download delta if available                    │
│     ├── Store in IndexedDB                             │
│     └── Load HNSW into WASM                            │
│                                                         │
│  3. Query (Client - instant)                           │
│     ├── Embed query via embedding-api                  │
│     ├── Search HNSW index (WASM)                       │
│     ├── Return top-k event IDs                         │
│     └── Fetch events from local cache                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// src/lib/search/wasm-search.ts
export class WasmSearch {
  private index: HNSWIndex | null = null;

  async initialize(): Promise<void> {
    // Non-blocking initialization
    if (!this.shouldSync()) return;

    // WiFi-only sync check
    const connection = navigator.connection;
    if (connection?.type !== 'wifi' && connection?.effectiveType !== '4g') {
      console.log('Skipping search sync - not on WiFi');
      return;
    }

    // Load from IndexedDB or fetch from GCS
    const indexData = await this.loadOrFetchIndex();
    this.index = await HNSWIndex.load(indexData);
  }

  async search(query: string, k: number = 10): Promise<SearchResult[]> {
    if (!this.index) return this.fallbackKeywordSearch(query);

    const embedding = await this.embedQuery(query);
    return this.index.search(embedding, k);
  }
}
```

### Storage Budget

| Component | Size | Location |
|-----------|------|----------|
| HNSW Index | ~50MB | IndexedDB |
| Embeddings | ~100MB | IndexedDB |
| WASM Runtime | ~2MB | Cache |
| Total | ~152MB | Client |

### Sync Strategy

```typescript
// WiFi-only sync with exponential backoff
const SYNC_CONFIG = {
  minInterval: 4 * 60 * 60 * 1000,  // 4 hours
  maxInterval: 24 * 60 * 60 * 1000, // 24 hours
  wifiOnly: true,
  maxRetries: 3
};
```

## Consequences

### Positive
- Instant search (no network latency)
- Privacy (queries stay local)
- Works offline
- No server search infrastructure

### Negative
- Initial download ~150MB
- IndexedDB storage required
- WiFi-only sync limits updates
- Mobile memory constraints

### Neutral
- Embedding API still needed for queries
- Index freshness depends on sync frequency

## Alternatives Considered

### Server-Side Elasticsearch
- Faster updates, no client storage
- Rejected: Privacy concerns, infrastructure cost

### SQLite FTS5 (WASM)
- Simpler, keyword-only
- Rejected: No semantic understanding

### No Search
- Simplest approach
- Rejected: Poor UX for large communities

## References

- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- GCS Bucket: `gs://nostr-bbs-vectors`
- Related: ADR-003 (GCP infrastructure)
