/**
 * RuVector Vector Search Service
 * Uses external PostgreSQL with JSONB embeddings for vector similarity search
 * Replaces hnswlib-wasm with server-side search + client-side caching
 */

import { db } from '$lib/db';

// RuVector API configuration (internal Docker network)
// Falls back to direct database connection via embedding-api proxy
const RUVECTOR_API_URL = import.meta.env.VITE_RUVECTOR_API_URL ||
  import.meta.env.VITE_EMBEDDING_API_URL ||
  'https://embedding-api-uc.a.run.app';

// Namespace for Nostr BBS semantic search
const NOSTR_BBS_NAMESPACE = 'nostr-bbs/semantic';
const PROJECT_ID = 'nostr-bbs';

export interface SearchResult {
  noteId: string;
  score: number;
  distance: number;
}

export interface RuVectorStats {
  vectorCount: number;
  dimensions: number;
  lastUpdated: string | null;
  searchMode: 'server' | 'cached' | 'hybrid';
}

// Local embedding cache for offline search
interface CachedEmbedding {
  noteId: string;
  embedding: number[];
  content?: string;
  timestamp: number;
}

let cachedEmbeddings: Map<string, CachedEmbedding> = new Map();
let cacheLoaded = false;
let lastCacheUpdate = 0;

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Generate query embedding via API
 */
async function embedQuery(query: string): Promise<number[]> {
  try {
    const response = await fetch(`${RUVECTOR_API_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query })
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json() as { embeddings: number[][]; dimensions: number };

    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error('No embedding returned from API');
    }

    return data.embeddings[0];
  } catch (error) {
    console.error('Embedding API call failed:', error);
    // Fallback to simple hash-based pseudo-embedding for offline use
    return generateFallbackEmbedding(query);
  }
}

/**
 * Fallback embedding when API is unavailable
 * Uses deterministic hash-based vector (not semantic, just for testing)
 */
function generateFallbackEmbedding(text: string): number[] {
  const dimensions = 384;
  const vector = new Array(dimensions).fill(0);

  // Simple hash-based deterministic vector
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const idx = (charCode * (i + 1)) % dimensions;
    vector[idx] += charCode / 255;
  }

  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map(v => v / norm);
}

/**
 * Load embeddings from RuVector into local cache
 */
export async function loadFromRuVector(): Promise<boolean> {
  try {
    // Try to fetch from RuVector API
    const response = await fetch(`${RUVECTOR_API_URL}/api/embeddings/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namespace: NOSTR_BBS_NAMESPACE,
        limit: 10000
      })
    });

    if (!response.ok) {
      console.warn('RuVector API not available, trying local cache');
      return loadFromIndexedDB();
    }

    const data = await response.json() as {
      embeddings: Array<{
        key: string;
        embedding: number[];
        metadata?: { noteId?: string; content?: string };
      }>;
    };

    if (!data.embeddings || data.embeddings.length === 0) {
      console.log('No embeddings in RuVector, trying local cache');
      return loadFromIndexedDB();
    }

    // Populate cache
    cachedEmbeddings.clear();
    for (const item of data.embeddings) {
      const noteId = item.metadata?.noteId || item.key;
      cachedEmbeddings.set(noteId, {
        noteId,
        embedding: item.embedding,
        content: item.metadata?.content,
        timestamp: Date.now()
      });
    }

    // Persist to IndexedDB for offline use
    await saveToIndexedDB();

    cacheLoaded = true;
    lastCacheUpdate = Date.now();
    console.log(`Loaded ${cachedEmbeddings.size} embeddings from RuVector`);
    return true;
  } catch (error) {
    console.error('Failed to load from RuVector:', error);
    return loadFromIndexedDB();
  }
}

/**
 * Load cached embeddings from IndexedDB (offline mode)
 */
async function loadFromIndexedDB(): Promise<boolean> {
  try {
    const cached = await db.table('embeddings').get('ruvector_cache');
    if (!cached?.data) {
      return false;
    }

    const entries = JSON.parse(cached.data) as CachedEmbedding[];
    cachedEmbeddings.clear();

    for (const entry of entries) {
      cachedEmbeddings.set(entry.noteId, entry);
    }

    cacheLoaded = cachedEmbeddings.size > 0;
    lastCacheUpdate = cached.timestamp || Date.now();
    console.log(`Loaded ${cachedEmbeddings.size} embeddings from IndexedDB cache`);
    return cacheLoaded;
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error);
    return false;
  }
}

/**
 * Save current cache to IndexedDB
 */
async function saveToIndexedDB(): Promise<void> {
  try {
    const entries = Array.from(cachedEmbeddings.values());
    await db.table('embeddings').put({
      key: 'ruvector_cache',
      data: JSON.stringify(entries),
      timestamp: Date.now(),
      count: entries.length
    });
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error);
  }
}

/**
 * Search for similar notes using server-side RuVector or local cache
 */
export async function searchSimilar(
  query: string,
  k: number = 10,
  minScore: number = 0.5
): Promise<SearchResult[]> {
  // Generate query embedding
  const queryVector = await embedQuery(query);

  // Try server-side search first (more accurate, uses HNSW if available)
  try {
    const serverResults = await searchServerSide(queryVector, k, minScore);
    if (serverResults.length > 0) {
      return serverResults;
    }
  } catch {
    console.log('Server search unavailable, using local cache');
  }

  // Fall back to local cache search
  return searchLocalCache(queryVector, k, minScore);
}

/**
 * Server-side vector search via RuVector API
 */
async function searchServerSide(
  queryVector: number[],
  k: number,
  minScore: number
): Promise<SearchResult[]> {
  const response = await fetch(`${RUVECTOR_API_URL}/api/embeddings/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embedding: queryVector,
      namespace: NOSTR_BBS_NAMESPACE,
      k,
      minScore
    })
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status}`);
  }

  const data = await response.json() as {
    results: Array<{
      key: string;
      score: number;
      metadata?: { noteId?: string };
    }>;
  };

  return data.results.map(r => ({
    noteId: r.metadata?.noteId || r.key,
    score: r.score,
    distance: 1 - r.score
  }));
}

/**
 * Local cache search using brute-force cosine similarity
 * O(n) but acceptable for <100k vectors in browser
 */
function searchLocalCache(
  queryVector: number[],
  k: number,
  minScore: number
): SearchResult[] {
  if (!cacheLoaded || cachedEmbeddings.size === 0) {
    throw new Error('Local cache not loaded');
  }

  const results: SearchResult[] = [];

  for (const [noteId, cached] of cachedEmbeddings) {
    const score = cosineSimilarity(queryVector, cached.embedding);
    if (score >= minScore) {
      results.push({
        noteId,
        score,
        distance: 1 - score
      });
    }
  }

  // Sort by score descending and take top k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}

/**
 * Check if semantic search is available
 */
export function isSearchAvailable(): boolean {
  return cacheLoaded && cachedEmbeddings.size > 0;
}

/**
 * Get search statistics
 */
export function getSearchStats(): RuVectorStats | null {
  if (!cacheLoaded) return null;

  return {
    vectorCount: cachedEmbeddings.size,
    dimensions: 384,
    lastUpdated: lastCacheUpdate ? new Date(lastCacheUpdate).toISOString() : null,
    searchMode: navigator.onLine ? 'hybrid' : 'cached'
  };
}

/**
 * Store a new embedding in RuVector
 */
export async function storeEmbedding(
  noteId: string,
  content: string
): Promise<boolean> {
  try {
    // Generate embedding
    const embedding = await embedQuery(content);

    // Store in RuVector
    const response = await fetch(`${RUVECTOR_API_URL}/api/embeddings/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: noteId,
        namespace: NOSTR_BBS_NAMESPACE,
        embedding,
        metadata: {
          noteId,
          content: content.slice(0, 500), // Truncate for metadata
          timestamp: Date.now()
        }
      })
    });

    if (response.ok) {
      // Update local cache
      cachedEmbeddings.set(noteId, {
        noteId,
        embedding,
        content: content.slice(0, 500),
        timestamp: Date.now()
      });

      // Debounce save to IndexedDB
      setTimeout(() => saveToIndexedDB(), 1000);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to store embedding:', error);
    return false;
  }
}

/**
 * Sync embeddings from server to local cache
 */
export async function syncEmbeddings(force = false): Promise<{ synced: boolean; count: number }> {
  // Check if online
  if (!navigator.onLine && !force) {
    return { synced: false, count: cachedEmbeddings.size };
  }

  const loaded = await loadFromRuVector();
  return {
    synced: loaded,
    count: cachedEmbeddings.size
  };
}

/**
 * Initialize RuVector search on app start
 */
export async function initRuVectorSearch(): Promise<void> {
  // Don't block app startup - sync in background
  setTimeout(async () => {
    try {
      // First try to load from IndexedDB (fast, offline)
      await loadFromIndexedDB();

      // Then try to sync from server (updates cache)
      if (navigator.onLine) {
        await loadFromRuVector();
      }
    } catch (error) {
      console.warn('Background RuVector sync failed:', error);
    }
  }, 3000);
}

/**
 * Unload embeddings to free memory
 */
export function unloadIndex(): void {
  cachedEmbeddings.clear();
  cacheLoaded = false;
}

/**
 * Alias for loadFromRuVector (compatibility with existing API)
 */
export const loadIndex = loadFromRuVector;

/**
 * Reset all module state (for testing)
 */
export function resetRuVectorState(): void {
  cachedEmbeddings.clear();
  cacheLoaded = false;
  lastCacheUpdate = 0;
}
