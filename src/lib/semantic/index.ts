/**
 * Semantic Search Module
 * Primary: RuVector PostgreSQL (pgvector with HNSW indexing)
 * Fallback: hnswlib-wasm for offline-only mode
 *
 * RuVector provides 150x-12,500x faster search vs brute-force
 * and enables cross-device sync via external PostgreSQL
 */

// Legacy HNSW exports (deprecated, use RuVector)
export {
  syncEmbeddings as syncHnswEmbeddings,
  initEmbeddingSync as initHnswSync,
  fetchManifest,
  shouldSync,
  getLocalSyncState,
  type EmbeddingManifest
} from './embeddings-sync';

export {
  loadIndex as loadHnswIndex,
  searchSimilar as searchHnswSimilar,
  isSearchAvailable as isHnswAvailable,
  getSearchStats as getHnswStats,
  unloadIndex as unloadHnswIndex,
  type SearchResult
} from './hnsw-search';

// RuVector exports (primary)
export {
  loadIndex,
  loadFromRuVector,
  searchSimilar,
  isSearchAvailable,
  getSearchStats,
  unloadIndex,
  syncEmbeddings,
  initRuVectorSearch,
  storeEmbedding,
  type RuVectorStats
} from './ruvector-search';

// Re-export SearchResult from ruvector (same interface)
export type { SearchResult as RuVectorSearchResult } from './ruvector-search';

// Initialize function that tries RuVector first, falls back to HNSW
export async function initSemanticSearch(): Promise<void> {
  const { initRuVectorSearch } = await import('./ruvector-search');
  const { initEmbeddingSync } = await import('./embeddings-sync');

  // Try RuVector first (server-side with PostgreSQL)
  await initRuVectorSearch();

  // Also init HNSW as fallback for fully offline mode
  await initEmbeddingSync();
}

export { default as SemanticSearch } from './SemanticSearch.svelte';
