/**
 * Solid Pod Storage Operations
 *
 * Provides CRUD operations for storing and retrieving data in Solid pods.
 * Handles Nostr events as RDF, manages LDP containers, and supports
 * offline-first operations with sync capability.
 */

import { browser } from '$app/environment';
import type {
  SolidContainer,
  SolidResource,
  NostrEventRDF,
  StorageResult,
  StorageError,
  StorageErrorCode,
  PodStoragePaths,
  SyncQueueItem,
  SyncState,
} from './types';
import { POD_CONTAINERS, RDF_NAMESPACES, NOSTR_RDF_VOCAB } from './types';
import { getSession, getAuthenticatedFetch, fetchWebIDProfile } from './client';
import { pubkeyToDID } from '$lib/nostr/did';

/**
 * Storage operation error
 */
export class StorageOperationError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageOperationError';
  }
}

/**
 * Offline sync queue (IndexedDB-backed in full implementation)
 */
let syncQueue: SyncQueueItem[] = [];
let syncState: SyncState = {
  isOnline: browser ? navigator.onLine : true,
  lastSyncTimestamp: null,
  pendingItems: 0,
  failedItems: 0,
  isSyncing: false,
};

// Online/offline event listeners
if (browser) {
  window.addEventListener('online', () => {
    syncState.isOnline = true;
    processSyncQueue();
  });
  window.addEventListener('offline', () => {
    syncState.isOnline = false;
  });
}

/**
 * Get the user's pod storage root URL
 */
export async function getPodStorageRoot(): Promise<string | null> {
  const session = getSession();

  if (!session.isLoggedIn || !session.webId) {
    return null;
  }

  try {
    const profile = await fetchWebIDProfile(session.webId);
    if (profile?.storage && profile.storage.length > 0) {
      return profile.storage[0];
    }

    // Derive storage from WebID
    const webIdUrl = new URL(session.webId);
    return `${webIdUrl.origin}/`;
  } catch (error) {
    console.error('[Storage] Failed to get pod storage root:', error);
    return null;
  }
}

/**
 * Get configured storage paths
 */
export async function getStoragePaths(): Promise<PodStoragePaths | null> {
  const root = await getPodStorageRoot();

  if (!root) {
    return null;
  }

  const baseRoot = root.endsWith('/') ? root : `${root}/`;

  return {
    root: baseRoot,
    nostrEvents: `${baseRoot}${POD_CONTAINERS.EVENTS}`,
    encryptedEvents: `${baseRoot}${POD_CONTAINERS.ENCRYPTED}`,
    profiles: `${baseRoot}${POD_CONTAINERS.PROFILES}`,
    messages: `${baseRoot}${POD_CONTAINERS.MESSAGES}`,
    preferences: `${baseRoot}${POD_CONTAINERS.PREFERENCES}`,
    publicData: `${baseRoot}${POD_CONTAINERS.PUBLIC}`,
    privateData: `${baseRoot}${POD_CONTAINERS.PRIVATE}`,
  };
}

/**
 * Initialize Nostr containers in the user's pod
 *
 * Creates the container structure needed for storing Nostr data.
 */
export async function initializeNostrContainers(): Promise<StorageResult<PodStoragePaths>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const containersToCreate = [
    POD_CONTAINERS.NOSTR,
    POD_CONTAINERS.EVENTS,
    POD_CONTAINERS.ENCRYPTED,
    POD_CONTAINERS.PROFILES,
    POD_CONTAINERS.MESSAGES,
    POD_CONTAINERS.PREFERENCES,
  ];

  const errors: Array<{ container: string; error: string }> = [];

  for (const container of containersToCreate) {
    const containerUrl = `${paths.root}${container}`;

    try {
      // Check if container exists
      const checkResponse = await fetchFn(containerUrl, {
        method: 'HEAD',
      });

      if (checkResponse.status === 404) {
        // Create container
        const createResponse = await fetchFn(containerUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          },
          body: `@prefix ldp: <http://www.w3.org/ns/ldp#> .
<> a ldp:BasicContainer .`,
        });

        if (!createResponse.ok && createResponse.status !== 201) {
          errors.push({
            container,
            error: `Failed to create: ${createResponse.status}`,
          });
        }
      }
    } catch (error) {
      errors.push({
        container,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      data: paths,
      error: {
        code: 'UNKNOWN',
        message: `Failed to create some containers`,
        details: errors,
      },
    };
  }

  return {
    success: true,
    data: paths,
  };
}

/**
 * Convert a Nostr event to RDF/Turtle format
 */
export function nostrEventToRDF(event: NostrEventRDF): string {
  const subject = `<urn:nostr:event:${event.id}>`;
  const did = pubkeyToDID(event.pubkey);

  const lines: string[] = [
    `@prefix nostr: <${RDF_NAMESPACES.nostr}> .`,
    `@prefix dc: <${RDF_NAMESPACES.dc}> .`,
    `@prefix xsd: <${RDF_NAMESPACES.xsd}> .`,
    '',
    subject,
    `    a nostr:Event ;`,
    `    nostr:id "${event.id}" ;`,
    `    nostr:kind ${event.kind} ;`,
    `    nostr:pubkey "${event.pubkey}" ;`,
    `    nostr:DID "${did}" ;`,
    `    nostr:createdAt "${event.created_at}"^^xsd:integer ;`,
    `    nostr:signature "${event.sig}" ;`,
  ];

  // Add content (escaped)
  const escapedContent = event.content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  lines.push(`    nostr:content "${escapedContent}" ;`);

  // Add encryption info if present
  if (event.encrypted) {
    lines.push(`    nostr:encrypted true ;`);
    if (event.encryptionMethod) {
      lines.push(`    nostr:encryptionMethod "${event.encryptionMethod}" ;`);
    }
  }

  // Add tags
  if (event.tags.length > 0) {
    const tagStrings = event.tags.map(tag =>
      `"${tag.map(t => t.replace(/"/g, '\\"')).join(',')}"`
    );
    lines.push(`    nostr:tag ${tagStrings.join(', ')} ;`);
  }

  // Add timestamp
  lines.push(`    dc:created "${new Date(event.created_at * 1000).toISOString()}"^^xsd:dateTime .`);

  return lines.join('\n');
}

/**
 * Parse RDF/Turtle back to Nostr event
 */
export function rdfToNostrEvent(rdf: string): NostrEventRDF | null {
  try {
    const event: Partial<NostrEventRDF> = {};

    // Extract values using regex (simple parser)
    const idMatch = rdf.match(/nostr:id\s+"([^"]+)"/);
    if (idMatch) event.id = idMatch[1];

    const kindMatch = rdf.match(/nostr:kind\s+(\d+)/);
    if (kindMatch) event.kind = parseInt(kindMatch[1], 10);

    const pubkeyMatch = rdf.match(/nostr:pubkey\s+"([^"]+)"/);
    if (pubkeyMatch) event.pubkey = pubkeyMatch[1];

    const createdAtMatch = rdf.match(/nostr:createdAt\s+"(\d+)"/);
    if (createdAtMatch) event.created_at = parseInt(createdAtMatch[1], 10);

    const sigMatch = rdf.match(/nostr:signature\s+"([^"]+)"/);
    if (sigMatch) event.sig = sigMatch[1];

    const contentMatch = rdf.match(/nostr:content\s+"((?:[^"\\]|\\.)*)"/);
    if (contentMatch) {
      event.content = contentMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    const encryptedMatch = rdf.match(/nostr:encrypted\s+true/);
    if (encryptedMatch) event.encrypted = true;

    const encMethodMatch = rdf.match(/nostr:encryptionMethod\s+"([^"]+)"/);
    if (encMethodMatch) event.encryptionMethod = encMethodMatch[1] as 'nip44' | 'nip04';

    // Parse tags
    const tagMatches = rdf.matchAll(/nostr:tag\s+"([^"]+)"/g);
    event.tags = [];
    for (const match of tagMatches) {
      event.tags.push(match[1].split(','));
    }

    // Validate required fields
    if (!event.id || !event.pubkey || !event.sig || event.kind === undefined) {
      return null;
    }

    return event as NostrEventRDF;
  } catch {
    return null;
  }
}

/**
 * Store a Nostr event in the user's pod
 */
export async function storeNostrEvent(
  event: NostrEventRDF,
  options?: {
    container?: string;
    encrypt?: boolean;
  }
): Promise<StorageResult<string>> {
  const paths = await getStoragePaths();

  if (!paths) {
    // Queue for offline sync
    if (browser && !syncState.isOnline) {
      return queueOperation('create', '', event);
    }
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    // Queue for offline sync
    if (browser && !syncState.isOnline) {
      return queueOperation('create', '', event);
    }
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const container = options?.container ||
    (event.encrypted ? paths.encryptedEvents : paths.nostrEvents);
  const resourceUrl = `${container}${event.id}.ttl`;

  try {
    const rdf = nostrEventToRDF(event);

    const response = await fetchFn(resourceUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: rdf,
    });

    if (!response.ok) {
      return {
        success: false,
        error: createStorageError(response.status, 'Failed to store event'),
      };
    }

    return {
      success: true,
      data: event.id,
      url: resourceUrl,
    };
  } catch (error) {
    // Queue for offline sync on network errors
    if (browser && error instanceof TypeError) {
      return queueOperation('create', resourceUrl, event);
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Retrieve a Nostr event from the pod
 */
export async function retrieveNostrEvent(
  eventId: string,
  container?: string
): Promise<StorageResult<NostrEventRDF>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  // Try both regular and encrypted containers if not specified
  const containersToTry = container
    ? [container]
    : [paths.nostrEvents, paths.encryptedEvents];

  for (const cont of containersToTry) {
    const resourceUrl = `${cont}${eventId}.ttl`;

    try {
      const response = await fetchFn(resourceUrl, {
        headers: {
          Accept: 'text/turtle',
        },
      });

      if (response.ok) {
        const rdf = await response.text();
        const event = rdfToNostrEvent(rdf);

        if (event) {
          return {
            success: true,
            data: event,
            url: resourceUrl,
          };
        }
      }
    } catch {
      // Continue to next container
    }
  }

  return {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Event ${eventId} not found`,
    },
  };
}

/**
 * Delete a Nostr event from the pod
 */
export async function deleteNostrEvent(
  eventId: string,
  container?: string
): Promise<StorageResult<void>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const containersToTry = container
    ? [container]
    : [paths.nostrEvents, paths.encryptedEvents];

  for (const cont of containersToTry) {
    const resourceUrl = `${cont}${eventId}.ttl`;

    try {
      const response = await fetchFn(resourceUrl, {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        return {
          success: true,
          url: resourceUrl,
        };
      }
    } catch {
      // Continue to next container
    }
  }

  return {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Event ${eventId} not found for deletion`,
    },
  };
}

/**
 * List Nostr events in a container
 */
export async function listNostrEvents(
  container?: string,
  options?: {
    limit?: number;
    offset?: number;
    filter?: {
      kind?: number;
      pubkey?: string;
      since?: number;
      until?: number;
    };
  }
): Promise<StorageResult<NostrEventRDF[]>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const targetContainer = container || paths.nostrEvents;

  try {
    // Fetch container listing
    const response = await fetchFn(targetContainer, {
      headers: {
        Accept: 'text/turtle',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: createStorageError(response.status, 'Failed to list container'),
      };
    }

    const containerRdf = await response.text();

    // Extract resource URLs from container listing
    const resourceUrls = extractContainedResources(containerRdf);

    // Fetch each resource
    const events: NostrEventRDF[] = [];
    let fetched = 0;
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    for (const url of resourceUrls) {
      if (!url.endsWith('.ttl')) continue;

      try {
        const eventResponse = await fetchFn(url, {
          headers: {
            Accept: 'text/turtle',
          },
        });

        if (eventResponse.ok) {
          const eventRdf = await eventResponse.text();
          const event = rdfToNostrEvent(eventRdf);

          if (event && matchesFilter(event, options?.filter)) {
            fetched++;
            if (fetched > offset && events.length < limit) {
              events.push(event);
            }
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    return {
      success: true,
      data: events,
      url: targetContainer,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Extract contained resource URLs from container RDF
 */
function extractContainedResources(rdf: string): string[] {
  const urls: string[] = [];
  const matches = rdf.matchAll(/ldp:contains\s+<([^>]+)>/g);

  for (const match of matches) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 * Check if event matches filter criteria
 */
function matchesFilter(
  event: NostrEventRDF,
  filter?: {
    kind?: number;
    pubkey?: string;
    since?: number;
    until?: number;
  }
): boolean {
  if (!filter) return true;

  if (filter.kind !== undefined && event.kind !== filter.kind) {
    return false;
  }

  if (filter.pubkey && event.pubkey !== filter.pubkey) {
    return false;
  }

  if (filter.since && event.created_at < filter.since) {
    return false;
  }

  if (filter.until && event.created_at > filter.until) {
    return false;
  }

  return true;
}

/**
 * Store generic data in the pod
 */
export async function storeData<T>(
  path: string,
  data: T,
  contentType: string = 'application/json'
): Promise<StorageResult<string>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const resourceUrl = path.startsWith('http') ? path : `${paths.root}${path}`;

  try {
    const body = contentType.includes('json') ? JSON.stringify(data) : String(data);

    const response = await fetchFn(resourceUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body,
    });

    if (!response.ok) {
      return {
        success: false,
        error: createStorageError(response.status, 'Failed to store data'),
      };
    }

    return {
      success: true,
      url: resourceUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Retrieve generic data from the pod
 */
export async function retrieveData<T>(
  path: string,
  contentType: string = 'application/json'
): Promise<StorageResult<T>> {
  const paths = await getStoragePaths();

  if (!paths) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in or no storage available',
      },
    };
  }

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authenticated fetch available',
      },
    };
  }

  const resourceUrl = path.startsWith('http') ? path : `${paths.root}${path}`;

  try {
    const response = await fetchFn(resourceUrl, {
      headers: {
        Accept: contentType,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: createStorageError(response.status, 'Failed to retrieve data'),
      };
    }

    const data = contentType.includes('json')
      ? await response.json()
      : await response.text();

    return {
      success: true,
      data: data as T,
      url: resourceUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        details: error,
      },
    };
  }
}

/**
 * Create storage error from HTTP status
 */
function createStorageError(status: number, message: string): StorageError {
  let code: StorageErrorCode;

  switch (status) {
    case 401:
      code = 'UNAUTHORIZED';
      break;
    case 403:
      code = 'FORBIDDEN';
      break;
    case 404:
      code = 'NOT_FOUND';
      break;
    case 409:
      code = 'CONFLICT';
      break;
    default:
      code = 'UNKNOWN';
  }

  return {
    code,
    message,
    statusCode: status,
  };
}

/**
 * Queue operation for offline sync
 */
function queueOperation(
  operation: 'create' | 'update' | 'delete',
  resourceUrl: string,
  data?: unknown
): StorageResult<string> {
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    operation,
    resourceUrl,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  syncQueue.push(item);
  syncState.pendingItems = syncQueue.length;

  // Store in localStorage for persistence
  if (browser) {
    localStorage.setItem('solid_sync_queue', JSON.stringify(syncQueue));
  }

  return {
    success: true,
    data: item.id,
    error: {
      code: 'NETWORK_ERROR',
      message: 'Operation queued for offline sync',
    },
  };
}

/**
 * Process the offline sync queue
 */
export async function processSyncQueue(): Promise<SyncState> {
  if (!browser || !syncState.isOnline || syncState.isSyncing) {
    return syncState;
  }

  syncState.isSyncing = true;

  const fetchFn = getAuthenticatedFetch();
  if (!fetchFn) {
    syncState.isSyncing = false;
    return syncState;
  }

  const failedItems: SyncQueueItem[] = [];

  for (const item of syncQueue) {
    try {
      let response: Response;

      switch (item.operation) {
        case 'create':
        case 'update':
          const rdf = item.data ? nostrEventToRDF(item.data as NostrEventRDF) : '';
          response = await fetchFn(item.resourceUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/turtle' },
            body: rdf,
          });
          break;

        case 'delete':
          response = await fetchFn(item.resourceUrl, {
            method: 'DELETE',
          });
          break;
      }

      if (!response!.ok && response!.status !== 204) {
        item.retryCount++;
        item.lastError = `HTTP ${response!.status}`;
        if (item.retryCount < 3) {
          failedItems.push(item);
        }
      }
    } catch (error) {
      item.retryCount++;
      item.lastError = error instanceof Error ? error.message : 'Unknown error';
      if (item.retryCount < 3) {
        failedItems.push(item);
      }
    }
  }

  syncQueue = failedItems;
  syncState.pendingItems = syncQueue.length;
  syncState.failedItems = failedItems.filter(i => i.retryCount >= 3).length;
  syncState.lastSyncTimestamp = Date.now();
  syncState.isSyncing = false;

  // Update localStorage
  if (browser) {
    localStorage.setItem('solid_sync_queue', JSON.stringify(syncQueue));
  }

  return syncState;
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Load sync queue from localStorage
 */
export function loadSyncQueue(): void {
  if (!browser) return;

  try {
    const stored = localStorage.getItem('solid_sync_queue');
    if (stored) {
      syncQueue = JSON.parse(stored);
      syncState.pendingItems = syncQueue.length;
    }
  } catch {
    syncQueue = [];
  }
}

/**
 * Clear sync queue
 */
export function clearSyncQueue(): void {
  syncQueue = [];
  syncState.pendingItems = 0;
  syncState.failedItems = 0;

  if (browser) {
    localStorage.removeItem('solid_sync_queue');
  }
}

export default {
  getPodStorageRoot,
  getStoragePaths,
  initializeNostrContainers,
  nostrEventToRDF,
  rdfToNostrEvent,
  storeNostrEvent,
  retrieveNostrEvent,
  deleteNostrEvent,
  listNostrEvents,
  storeData,
  retrieveData,
  processSyncQueue,
  getSyncState,
  loadSyncQueue,
  clearSyncQueue,
  StorageOperationError,
};
