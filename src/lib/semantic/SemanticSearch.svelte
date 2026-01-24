<script lang="ts">
  import { onMount } from 'svelte';
  import {
    searchSimilar,
    isSearchAvailable,
    getSearchStats,
    loadIndex,
    syncEmbeddings,
    type SearchResult,
    type RuVectorStats
  } from './ruvector-search';
  import { shouldSync } from './embeddings-sync';

  // Props
  export let onSelect: (noteId: string) => void = () => {};
  export let placeholder = 'Search by meaning...';

  // State
  let query = '';
  let results: SearchResult[] = [];
  let isSearching = false;
  let error: string | null = null;
  let stats: RuVectorStats | null = null;
  let indexLoaded = false;
  let searchMode: 'server' | 'cached' | 'hybrid' = 'hybrid';

  // Debounce search
  let searchTimeout: ReturnType<typeof setTimeout>;

  onMount(async () => {
    // Try to load RuVector index (from server or local cache)
    try {
      indexLoaded = await loadIndex();
      if (indexLoaded) {
        stats = getSearchStats();
        searchMode = stats?.searchMode || 'hybrid';
      }
    } catch (e) {
      console.warn('Failed to load search index:', e);
    }
  });

  async function handleSearch() {
    if (!query.trim()) {
      results = [];
      return;
    }

    if (!indexLoaded) {
      error = 'Search index not loaded. Sync embeddings first.';
      return;
    }

    isSearching = true;
    error = null;

    try {
      results = await searchSimilar(query, 10, 0.3);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Search failed';
      results = [];
    } finally {
      isSearching = false;
    }
  }

  function handleInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(handleSearch, 300);
  }

  async function handleSync() {
    if (!shouldSync() && !navigator.onLine) {
      error = 'Please connect to sync embeddings';
      return;
    }

    isSearching = true;
    error = null;

    try {
      const result = await syncEmbeddings(true);
      if (result.synced) {
        indexLoaded = true;
        stats = getSearchStats();
        searchMode = stats?.searchMode || 'hybrid';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Sync failed';
    } finally {
      isSearching = false;
    }
  }

  function selectResult(noteId: string) {
    onSelect(noteId);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  }

  function getSearchModeLabel(mode: string): string {
    switch (mode) {
      case 'server': return 'RuVector (server)';
      case 'cached': return 'Offline cache';
      case 'hybrid': return 'RuVector + cache';
      default: return mode;
    }
  }
</script>

<div class="semantic-search">
  <div class="search-header">
    <div class="search-input-wrapper">
      <input
        type="text"
        bind:value={query}
        on:input={handleInput}
        {placeholder}
        class="search-input"
        disabled={!indexLoaded}
      />
      {#if isSearching}
        <span class="loading-indicator">...</span>
      {/if}
    </div>

    <button
      class="sync-btn"
      on:click={handleSync}
      disabled={isSearching}
      title="Sync embeddings"
    >
      ↻
    </button>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if !indexLoaded}
    <div class="info-message">
      <p>Semantic search requires downloading the search index.</p>
      {#if shouldSync()}
        <button on:click={handleSync} disabled={isSearching}>
          Download Index
        </button>
      {:else}
        <p class="wifi-notice">Connect to WiFi to download.</p>
      {/if}
    </div>
  {:else if stats}
    <div class="stats">
      <span>{stats.vectorCount.toLocaleString()} messages indexed</span>
      <span>{getSearchModeLabel(searchMode)} • {formatDate(stats.lastUpdated)}</span>
    </div>
  {/if}

  {#if results.length > 0}
    <div class="results">
      {#each results as result}
        <button
          class="result-item"
          on:click={() => selectResult(result.noteId)}
        >
          <span class="note-id">{result.noteId.slice(0, 8)}...</span>
          <span class="score">{(result.score * 100).toFixed(0)}% match</span>
        </button>
      {/each}
    </div>
  {:else if query && !isSearching && indexLoaded}
    <div class="no-results">No matching messages found</div>
  {/if}
</div>

<style>
  .semantic-search {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: oklch(var(--b1));
    color: oklch(var(--bc));
  }

  .search-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid oklch(var(--b3));
    border-radius: 8px;
    font-size: 1rem;
    background: oklch(var(--b2));
    color: oklch(var(--bc));
  }

  .search-input:focus {
    outline: none;
    border-color: oklch(var(--p));
    box-shadow: 0 0 0 2px oklch(var(--p) / 0.2);
  }

  .search-input::placeholder {
    color: oklch(var(--bc) / 0.5);
  }

  .search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-indicator {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: oklch(var(--bc) / 0.6);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .sync-btn {
    padding: 0.75rem;
    border: 1px solid oklch(var(--b3));
    border-radius: 8px;
    background: oklch(var(--b2));
    color: oklch(var(--bc));
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s ease;
  }

  .sync-btn:hover:not(:disabled) {
    background: oklch(var(--b3));
    border-color: oklch(var(--p));
  }

  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    padding: 0.5rem;
    background: oklch(var(--er) / 0.1);
    color: oklch(var(--er));
    border: 1px solid oklch(var(--er) / 0.3);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .info-message {
    padding: 1rem;
    background: oklch(var(--in) / 0.1);
    border: 1px solid oklch(var(--in) / 0.3);
    border-radius: 8px;
    text-align: center;
    color: oklch(var(--bc));
  }

  .info-message p {
    margin: 0 0 0.5rem 0;
  }

  .info-message button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: oklch(var(--p));
    color: oklch(var(--pc));
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .info-message button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .info-message button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wifi-notice {
    font-size: 0.875rem;
    color: oklch(var(--bc) / 0.6);
  }

  .stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: oklch(var(--bc) / 0.6);
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem;
    background: oklch(var(--b2));
    border: 1px solid oklch(var(--b3));
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: oklch(var(--bc));
    transition: all 0.2s ease;
  }

  .result-item:hover {
    background: oklch(var(--b3));
    border-color: oklch(var(--p));
  }

  .note-id {
    font-family: monospace;
    font-size: 0.875rem;
    color: oklch(var(--bc));
  }

  .score {
    font-size: 0.75rem;
    color: oklch(var(--suc));
    background: oklch(var(--su) / 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
  }

  .no-results {
    text-align: center;
    padding: 1rem;
    color: oklch(var(--bc) / 0.6);
  }
</style>
