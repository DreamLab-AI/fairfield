/**
 * Embedding Sync Service
 * Lazy-loads vector embeddings from R2 over WiFi only
 */

import { db } from '$lib/db';

// Google Cloud Storage public URL (configured via environment)
// Embeddings stored in public GCS bucket: Nostr-BBS-vectors
const GCS_BASE_URL = import.meta.env.VITE_GCS_EMBEDDINGS_URL || 'https://storage.googleapis.com/Nostr-BBS-vectors';

export interface EmbeddingManifest {
  version: number;
  updated_at: string;
  total_vectors: number;
  dimensions: number;
  model: string;
  quantize_type: 'int8' | 'float32';
  index_size_bytes: number;
  embeddings_size_bytes: number;
  latest: {
    index: string;
    index_mapping: string;
    embeddings: string;
    manifest: string;
  };
}

interface SyncState {
  version: number;
  lastSynced: number;
  indexLoaded: boolean;
}

interface NetworkInformation {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
  metered?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

// Storage key for user's sync preference
const SYNC_PREFERENCE_KEY = 'embedding_sync_preference';

/**
 * Detect if running on Safari (iOS or macOS)
 * Safari doesn't support navigator.connection API
 */
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Safari but not Chrome/Edge (which include Safari in UA)
  return /Safari/.test(ua) && !/Chrome|CriOS|Edg/.test(ua);
}

/**
 * Detect if running on iOS (Safari or PWA)
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Check if user has explicitly opted in/out of mobile sync
 */
export function getUserSyncPreference(): 'wifi-only' | 'always' | 'manual' | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(SYNC_PREFERENCE_KEY) as 'wifi-only' | 'always' | 'manual' | null;
}

/**
 * Set user's sync preference
 */
export function setUserSyncPreference(pref: 'wifi-only' | 'always' | 'manual'): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SYNC_PREFERENCE_KEY, pref);
}

/**
 * Check if we should sync embeddings
 * Safari-compatible: Uses fallback heuristics when navigator.connection unavailable
 */
export function shouldSync(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Check user preference first
  const preference = getUserSyncPreference();
  if (preference === 'always') return true;
  if (preference === 'manual') return false;

  const connection = (navigator as NavigatorWithConnection).connection;

  // Safari/iOS fallback: navigator.connection not supported
  if (!connection) {
    // On iOS, be conservative - default to manual sync
    // Users can opt-in via settings
    if (isIOS()) {
      if (import.meta.env.DEV) {
        console.log('[EmbeddingSync] iOS detected without connection API - defaulting to manual sync');
      }
      return false;
    }

    // Desktop Safari on macOS: likely on WiFi, allow sync
    if (isSafari()) {
      if (import.meta.env.DEV) {
        console.log('[EmbeddingSync] macOS Safari detected - assuming WiFi connection');
      }
      return true;
    }

    // Unknown browser without connection API - allow sync (desktop likely)
    return true;
  }

  // Check for WiFi or ethernet
  const type = connection.type;
  if (type === 'wifi' || type === 'ethernet') {
    return true;
  }

  // Check effective type for fast connections
  const effectiveType = connection.effectiveType;
  if (effectiveType === '4g' && !connection.saveData) {
    return true;
  }

  // Check if not metered
  if (connection.metered === false) {
    return true;
  }

  return false;
}

/**
 * Get human-readable connection status for UI
 */
export function getConnectionStatus(): { canSync: boolean; reason: string; platform: string } {
  if (typeof navigator === 'undefined') {
    return { canSync: false, reason: 'Server-side rendering', platform: 'ssr' };
  }

  const preference = getUserSyncPreference();
  if (preference === 'always') {
    return { canSync: true, reason: 'User preference: always sync', platform: 'user-override' };
  }
  if (preference === 'manual') {
    return { canSync: false, reason: 'User preference: manual sync only', platform: 'user-override' };
  }

  const connection = (navigator as NavigatorWithConnection).connection;

  if (!connection) {
    if (isIOS()) {
      return {
        canSync: false,
        reason: 'iOS detected - enable "Always sync" in settings to sync on mobile',
        platform: 'ios'
      };
    }
    if (isSafari()) {
      return { canSync: true, reason: 'macOS Safari - assuming WiFi', platform: 'macos-safari' };
    }
    return { canSync: true, reason: 'Connection type unknown - allowing sync', platform: 'unknown' };
  }

  const type = connection.type;
  const effectiveType = connection.effectiveType;

  if (type === 'wifi' || type === 'ethernet') {
    return { canSync: true, reason: `Connected via ${type}`, platform: type };
  }

  if (effectiveType === '4g' && !connection.saveData) {
    return { canSync: true, reason: 'Fast 4G connection', platform: '4g' };
  }

  if (connection.metered === false) {
    return { canSync: true, reason: 'Unmetered connection', platform: 'unmetered' };
  }

  return {
    canSync: false,
    reason: `Metered ${effectiveType || type || 'mobile'} connection - sync on WiFi`,
    platform: effectiveType || type || 'mobile'
  };
}

/**
 * Fetch the current manifest from Google Cloud Storage
 */
export async function fetchManifest(): Promise<EmbeddingManifest | null> {
  try {
    const response = await fetch(`${GCS_BASE_URL}/latest/manifest.json`, {
      cache: 'no-cache'
    });

    if (!response.ok) {
      console.warn('Failed to fetch embedding manifest:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('Error fetching embedding manifest:', error);
    return null;
  }
}

/**
 * Get local sync state from IndexedDB
 */
export async function getLocalSyncState(): Promise<SyncState | null> {
  try {
    const state = await db.table('metadata').get('embedding_sync_state');
    return (state?.value as SyncState) ?? null;
  } catch {
    return null;
  }
}

/**
 * Save local sync state
 */
async function saveSyncState(state: SyncState): Promise<void> {
  await db.table('metadata').put({
    key: 'embedding_sync_state',
    value: state
  });
}

/**
 * Download and store index files
 */
async function downloadIndex(manifest: EmbeddingManifest): Promise<boolean> {
  try {
    console.log(`Downloading HNSW index (${(manifest.index_size_bytes / 1024 / 1024).toFixed(1)} MB)...`);

    // Download index.bin
    const indexResponse = await fetch(`${GCS_BASE_URL}/${manifest.latest.index}`);
    if (!indexResponse.ok) throw new Error('Failed to download index');
    const indexBuffer = await indexResponse.arrayBuffer();

    // Download mapping
    const mappingResponse = await fetch(`${GCS_BASE_URL}/${manifest.latest.index_mapping}`);
    if (!mappingResponse.ok) throw new Error('Failed to download mapping');
    const mappingBuffer = await mappingResponse.arrayBuffer();

    // Store in IndexedDB
    await db.table('embeddings').put({
      key: 'hnsw_index',
      data: indexBuffer,
      version: manifest.version
    });

    await db.table('embeddings').put({
      key: 'index_mapping',
      data: mappingBuffer,
      version: manifest.version
    });

    console.log('Index downloaded and stored');
    return true;
  } catch (error) {
    console.error('Error downloading index:', error);
    return false;
  }
}

/**
 * Main sync function - checks and downloads new embeddings
 */
export async function syncEmbeddings(force = false): Promise<{ synced: boolean; version: number }> {
  // Check if we should sync
  if (!force && !shouldSync()) {
    console.log('Skipping embedding sync (not on WiFi)');
    return { synced: false, version: 0 };
  }

  // Get current local state
  const localState = await getLocalSyncState();
  const localVersion = localState?.version || 0;

  // Fetch remote manifest
  const manifest = await fetchManifest();
  if (!manifest) {
    return { synced: false, version: localVersion };
  }

  // Check if we need to update
  if (!force && manifest.version <= localVersion) {
    console.log(`Embeddings up to date (v${localVersion})`);
    return { synced: false, version: localVersion };
  }

  console.log(`Updating embeddings: v${localVersion} -> v${manifest.version}`);

  // Download new index
  const success = await downloadIndex(manifest);

  if (success) {
    // Update local state
    await saveSyncState({
      version: manifest.version,
      lastSynced: Date.now(),
      indexLoaded: false // Will be set when actually loaded into memory
    });

    return { synced: true, version: manifest.version };
  }

  return { synced: false, version: localVersion };
}

/**
 * Initialize sync on app start
 */
export async function initEmbeddingSync(): Promise<void> {
  // Don't block app startup - sync in background
  setTimeout(async () => {
    try {
      const result = await syncEmbeddings();
      if (result.synced) {
        console.log(`Embeddings synced to v${result.version}`);
      }
    } catch (error) {
      console.warn('Background embedding sync failed:', error);
    }
  }, 5000); // Wait 5s after app start
}
