/**
 * Solid Pods Integration Layer
 *
 * This module provides a complete integration between the Fairfield Nostr application
 * and Solid pods. It bridges Nostr's cryptographic identity (did:nostr) with Solid's
 * WebID system, enabling:
 *
 * - Decentralized identity linking between Nostr and Solid
 * - Encrypted Nostr event storage in user's Solid pod
 * - Permission synchronization between Nostr cohorts and Solid ACL
 * - Offline-first storage with background sync capability
 *
 * @module solid
 */

// Client - Session management and authentication
export {
  initializeSolidClient,
  getConfig,
  getSession,
  isLoggedIn,
  getAuthenticatedFetch,
  login,
  logout,
  handleIncomingRedirect,
  fetchWebIDProfile,
  refreshSession,
  onSessionChange,
  SolidClientError,
} from './client';

// WebID Bridge - DID to WebID conversion
export {
  didToWebID,
  pubkeyToWebID,
  webIDToPubkey,
  createWebIDProfileFromPubkey,
  linkNostrIdentityToWebID,
  getLinkedNostrIdentity,
  verifyWebIDNostrLink,
  resolveNostrDIDToWebID,
  resolveWebIDToNostrDID,
  createUnifiedDIDDocument,
  registerMapping,
  clearMappingCache,
  getCachedMappings,
  WebIDBridgeError,
} from './webid';

// Storage - Pod CRUD operations
export {
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
} from './storage';

// ACL - Access control management
export {
  getACLUrl,
  parseACLDocument,
  generateACLDocument,
  getACL,
  setACL,
  grantAccess,
  revokeAccess,
  mapCohortToACLModes,
  createCohortACLMapping,
  syncNostrPermissionsToACL,
  checkAccess,
  getAccessList,
  makePublic,
  makePrivate,
  clearACLCache,
  ACLOperationError,
} from './acl';

// Types
export type {
  SolidSession,
  SolidLoginOptions,
  SolidLogoutOptions,
  WebIDProfile,
  WebIDPreferences,
  NostrIdentityLink,
  SolidContainer,
  SolidResource,
  NostrEventRDF,
  StorageResult,
  StorageError,
  StorageErrorCode,
  PodStoragePaths,
  ACLMode,
  ACLEntry,
  ACLSubject,
  CohortACLMapping,
  PermissionSyncRequest,
  PermissionSyncResult,
  ACLSyncError,
  DIDWebIDMapping,
  SyncQueueItem,
  SyncState,
  SolidIntegrationConfig,
} from './types';

// Constants
export {
  RDF_NAMESPACES,
  NOSTR_RDF_VOCAB,
  POD_CONTAINERS,
  DEFAULT_SOLID_CONFIG,
} from './types';

/**
 * Initialize the Solid integration layer
 *
 * Call this function on application startup to set up Solid authentication
 * and handle any incoming OIDC redirects.
 *
 * @example
 * ```typescript
 * import { initializeSolid } from '$lib/solid';
 *
 * // In your app initialization
 * await initializeSolid({
 *   defaultOidcIssuer: 'https://solidcommunity.net',
 *   clientName: 'My Nostr App',
 * });
 * ```
 */
export async function initializeSolid(
  config?: Partial<import('./types').SolidIntegrationConfig>
): Promise<void> {
  const { initializeSolidClient, handleIncomingRedirect } = await import('./client');
  const { loadSyncQueue, processSyncQueue } = await import('./storage');

  // Initialize client with config
  initializeSolidClient(config);

  // Handle any incoming auth redirect
  await handleIncomingRedirect();

  // Load offline sync queue
  loadSyncQueue();

  // Attempt to process any pending sync items
  processSyncQueue();
}

/**
 * Connect Nostr identity to Solid
 *
 * Links the user's Nostr public key to their Solid WebID profile,
 * creating a verifiable connection between the two identity systems.
 *
 * @example
 * ```typescript
 * import { connectNostrToSolid } from '$lib/solid';
 *
 * // After user logs in with Nostr
 * const result = await connectNostrToSolid(userPubkey, ['wss://relay1.example.com']);
 * if (result.success) {
 *   console.log('Identity linked:', result.data);
 * }
 * ```
 */
export async function connectNostrToSolid(
  nostrPubkey: string,
  relays?: string[]
): Promise<import('./types').StorageResult<import('./types').NostrIdentityLink>> {
  const { isLoggedIn } = await import('./client');
  const { linkNostrIdentityToWebID } = await import('./webid');
  const { initializeNostrContainers } = await import('./storage');

  if (!isLoggedIn()) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to Solid first',
      },
    };
  }

  // Link identity to WebID profile
  const linkResult = await linkNostrIdentityToWebID(nostrPubkey, relays);

  if (!linkResult.success) {
    return linkResult;
  }

  // Initialize storage containers
  await initializeNostrContainers();

  return linkResult;
}

/**
 * Store a Nostr event in the user's Solid pod
 *
 * Converts the event to RDF format and stores it in the appropriate
 * container based on whether the event is encrypted.
 *
 * @example
 * ```typescript
 * import { storeEventInPod } from '$lib/solid';
 *
 * const result = await storeEventInPod({
 *   id: event.id,
 *   kind: event.kind,
 *   pubkey: event.pubkey,
 *   created_at: event.created_at,
 *   content: event.content,
 *   sig: event.sig,
 *   tags: event.tags,
 *   encrypted: true,
 *   encryptionMethod: 'nip44',
 * });
 * ```
 */
export async function storeEventInPod(
  event: import('./types').NostrEventRDF
): Promise<import('./types').StorageResult<string>> {
  const { storeNostrEvent } = await import('./storage');
  return storeNostrEvent(event);
}

/**
 * Sync Nostr cohort permissions to Solid ACL
 *
 * Takes a list of Nostr users with their cohort memberships and
 * updates the ACL on a Solid resource to match those permissions.
 *
 * @example
 * ```typescript
 * import { syncPermissions } from '$lib/solid';
 *
 * const result = await syncPermissions({
 *   resourceUrl: 'https://pod.example.com/nostr/events/',
 *   nostrPubkeys: ['abc123...', 'def456...'],
 *   cohorts: ['approved', 'business'],
 *   modes: ['Read', 'Write'],
 * });
 * ```
 */
export async function syncPermissions(
  request: import('./types').PermissionSyncRequest
): Promise<import('./types').PermissionSyncResult> {
  const { syncNostrPermissionsToACL } = await import('./acl');
  return syncNostrPermissionsToACL(request);
}

/**
 * Check if a Nostr user has access to a Solid resource
 *
 * @example
 * ```typescript
 * import { canAccess } from '$lib/solid';
 *
 * const hasRead = await canAccess(
 *   'https://pod.example.com/nostr/events/',
 *   nostrPubkey,
 *   'Read'
 * );
 * ```
 */
export async function canAccess(
  resourceUrl: string,
  nostrPubkey: string,
  mode: import('./types').ACLMode
): Promise<boolean> {
  const { checkAccess } = await import('./acl');
  const { pubkeyToWebID } = await import('./webid');

  const webId = pubkeyToWebID(nostrPubkey);
  return checkAccess(resourceUrl, webId, mode);
}
