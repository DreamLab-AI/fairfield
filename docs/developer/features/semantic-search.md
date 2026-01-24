---
title: "Semantic Vector Search"
description: "AI-powered search that understands meaning, not just keywords."
category: tutorial
tags: ['developer', 'search', 'user']
difficulty: beginner
last-updated: 2026-01-24
---

# Semantic Vector Search

AI-powered search that understands meaning, not just keywords.

---

## Overview

Semantic search enables users to find messages by meaning rather than exact keywords. Search for "schedule tomorrow's meeting" and find messages about "planning the session for Friday"—the system understands context and intent.

**Search Backends:**
- **Primary**: RuVector PostgreSQL (server-side, 150x-12,500x faster)
- **Fallback**: hnswlib-wasm (client-side, offline-only mode)

---

## Architecture

```mermaid
graph TB
    subgraph RuVector["RuVector PostgreSQL (Primary)"]
        PG["PostgreSQL<br/>pgvector + HNSW"]
        API["Embedding API<br/>Cloud Run"]
        Memory["Memory Store<br/>1.17M+ entries"]
    end

    subgraph Pipeline["Cloud-Based Embedding Pipeline"]
        CloudRun["Cloud Run API<br/>REST Endpoints"]
        Relay["Nostr Relay<br/>Fetch Messages"]
        ST["sentence-transformers<br/>all-MiniLM-L6-v2"]
    end

    subgraph PWA["PWA Client"]
        RuVClient["RuVector Client<br/>Hybrid Search"]
        WiFi{"Network<br/>Detection"}
        IDB["IndexedDB<br/>Cache"]
        WASM["hnswlib-wasm<br/>Fallback"]
        UI["SemanticSearch<br/>Component"]
    end

    CloudRun -->|1. Trigger| Relay
    Relay -->|2. Kind 1,9| ST
    ST -->|3. 384d Vectors| PG
    ST -->|3b. Store| Memory

    WiFi -->|4. Check Online| RuVClient
    RuVClient -->|5a. Server Search| API
    API -->|6. Query| PG
    RuVClient -->|5b. Offline| WASM
    RuVClient -->|7. Cache| IDB
    UI -->|8. Query| RuVClient
    RuVClient -->|9. Results| UI

    style RuVector fill:#10b981,color:#fff
    style Pipeline fill:#4285f4,color:#fff
    style PWA fill:#1e40af,color:#fff
```

---

## Key Features

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Semantic Understanding** | sentence-transformers/all-MiniLM-L6-v2 | Find by meaning, not just keywords |
| **RuVector Server Search** | PostgreSQL with HNSW indexing | 150x-12,500x faster than brute-force |
| **Hybrid Mode** | Server + local cache | Best of both worlds |
| **HNSW Fallback** | hnswlib-wasm (client-side) | Works fully offline |
| **Int8 Quantisation** | 75% storage reduction | 100k messages = ~15MB index |
| **Smart Sync** | Network-aware sync | Respects mobile data caps |
| **Cross-Device** | RuVector PostgreSQL | Shared embeddings across devices |

---

## Data Flow

```mermaid
sequenceDiagram
    participant API as Cloud Run API
    participant Relay as Nostr Relay
    participant GCS as Cloud Storage
    participant PWA as Browser PWA
    participant IDB as IndexedDB
    participant WASM as hnswlib-wasm

    Note over API,GCS: On-Demand Pipeline (API Triggered)
    API->>Relay: 1. Fetch kind 1 & 9 events
    Relay-->>API: 2. Return messages
    API->>API: 3. Generate embeddings (384d)
    API->>API: 4. Quantise to int8
    API->>API: 5. Build HNSW index
    API->>GCS: 6. Upload index + manifest

    Note over PWA,WASM: User Opens App
    PWA->>PWA: 7. Check WiFi connection
    PWA->>GCS: 8. Fetch manifest.json
    GCS-->>PWA: 9. Return version info

    alt New Version Available
        PWA->>GCS: 10. Download index.bin
        GCS-->>PWA: 11. Return ~15MB index
        PWA->>IDB: 12. Store in embeddings table
    end

    Note over PWA,WASM: User Searches
    PWA->>IDB: 13. Load index
    IDB-->>PWA: 14. Return ArrayBuffer
    PWA->>WASM: 15. Initialise HNSW
    PWA->>WASM: 16. searchKnn(query, k=10)
    WASM-->>PWA: 17. Return note IDs + scores
    PWA->>Relay: 18. Fetch full notes by ID
    Relay-->>PWA: 19. Return decrypted content
```

---

## Technical Specifications

```yaml
Embedding Model:
  name: sentence-transformers/all-MiniLM-L6-v2
  dimensions: 384
  performance: ~30 sec per 1,000 messages
  quantisation: int8 (75% size reduction)

HNSW Index:
  library: hnswlib (Python) + hnswlib-wasm (Browser)
  space: cosine similarity
  ef_construction: 200
  M: 16
  ef_search: 50

Storage:
  platform: Google Cloud Storage
  bucket: nostr-bbs-embeddings
  structure:
    - latest/manifest.json
    - latest/index.bin
    - latest/index_mapping.json
  versioning: Incremental (v1, v2, ...)

Client Sync:
  trigger: WiFi or unmetered connection
  storage: IndexedDB (embeddings table)
  lazy_load: true (background, non-blocking)
```

---

## Usage

### Component Integration

```svelte
<script>
  import { SemanticSearch } from '$lib/semantic';

  function handleSelect(noteId: string) {
    navigateToMessage(noteId);
  }
</script>

<SemanticSearch
  onSelect={handleSelect}
  placeholder="Search by meaning..."
/>
```

### Programmatic API

```typescript
import { searchSimilar, syncEmbeddings, isSearchAvailable } from '$lib/semantic';

// Sync index (automatic on WiFi)
await syncEmbeddings();

// Check availability
if (isSearchAvailable()) {
  // Search for similar messages
  const results = await searchSimilar('meeting tomorrow', 10, 0.5);
  // Returns: [{ noteId: 'abc123', score: 0.89, distance: 0.11 }, ...]
}
```

---

## API Reference

### syncEmbeddings()

Synchronises the local index with Cloud Storage.

```typescript
async function syncEmbeddings(): Promise<boolean>
```

**Returns:** `true` if sync successful, `false` if skipped (not on WiFi) or failed.

**Behaviour:**
1. Checks network type (WiFi/unmetered only)
2. Fetches manifest.json from GCS
3. Compares version with local cache
4. Downloads new index if newer version available
5. Stores in IndexedDB

### searchSimilar()

Performs semantic search on cached index.

```typescript
async function searchSimilar(
  query: string,
  k?: number,       // Default: 10
  threshold?: number // Default: 0.3 (minimum similarity)
): Promise<SearchResult[]>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Natural language search query |
| `k` | `number` | Maximum results to return |
| `threshold` | `number` | Minimum similarity score (0-1) |

**Returns:**

```typescript
interface SearchResult {
  noteId: string;    // Nostr event ID
  score: number;     // Similarity score (0-1)
  distance: number;  // Cosine distance
}
```

### isSearchAvailable()

Checks if semantic search is ready.

```typescript
function isSearchAvailable(): boolean
```

**Returns:** `true` if index is loaded and ready.

---

## Privacy Considerations

| Aspect | Implementation |
|--------|----------------|
| **No Content Storage** | Only embeddings stored, not message text |
| **Encrypted Messages Excluded** | NIP-17/59 DMs not indexed |
| **Local Processing** | Search runs entirely in browser via WASM |
| **User Control** | Manual sync button, no automatic uploads |
| **No Query Logging** | Searches never leave the device |

---

## Free Tier Budget

| Resource | Limit | Usage (100k msgs) | Headroom |
|----------|-------|-------------------|----------|
| **Cloud Run** | 2M requests/month | ~10k/month | 99.5% free |
| **Cloud Storage** | 5 GB storage | ~20 MB | 99.6% free |
| **GCS Reads** | 50k Class B ops/month | ~10k/month | 80% free |
| **GCS Egress** | 1 GB/month (free tier) | ~500 MB | 50% free |

---

## Embedding Pipeline

### Cloud Run API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/api/embeddings/generate` | POST | Generate embeddings for messages |
| `/api/embeddings/index` | POST | Build and upload HNSW index |
| `/api/embeddings/manifest` | GET | Get current index version |
| `/api/embeddings/sync` | POST | Trigger full sync pipeline |

### Pipeline Trigger

The pipeline runs on demand via API trigger or scheduled via GitHub Actions:

```yaml
# .github/workflows/update-embeddings.yml
name: Update Embeddings Index

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:     # Manual trigger

jobs:
  update-index:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger embedding pipeline
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" \
            https://embedding-api.run.app/api/embeddings/sync
```

---

## Troubleshooting

### Index Not Loading

```typescript
// Check IndexedDB
const db = await openDB('semantic-search', 1);
const manifest = await db.get('embeddings', 'manifest');
console.log('Local version:', manifest?.version);
```

### Search Returns No Results

1. **Index not synced** — Call `syncEmbeddings()` manually
2. **Threshold too high** — Lower the similarity threshold
3. **Query too short** — Provide more context in search

### High Memory Usage

The HNSW index loads entirely into memory. For 100k messages (~15MB index), expect ~30-50MB memory usage after decompression.

```typescript
// Check memory usage
if (performance.memory) {
  console.log('Used heap:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
}
```

---

## Related Documentation

- [Messaging](messaging.md) — Message system
- [PWA Features](pwa.md) — Offline capabilities
- [Data Flow](../architecture/data-flow.md) — State flow patterns

---

[← Back to Developer Documentation](../index.md)
