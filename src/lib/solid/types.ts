/**
 * Solid Pods TypeScript Type Definitions
 *
 * Type definitions for Solid pod integration with Fairfield Nostr application.
 * Covers session management, WebID profiles, storage operations, and access control.
 */

/**
 * Solid Session state
 */
export interface SolidSession {
  isLoggedIn: boolean;
  webId: string | null;
  fetch: typeof fetch | null;
  expirationDate: Date | null;
}

/**
 * Solid login options
 */
export interface SolidLoginOptions {
  oidcIssuer: string;
  redirectUrl: string;
  clientName?: string;
  clientId?: string;
  tokenType?: 'Bearer' | 'DPoP';
}

/**
 * Solid logout options
 */
export interface SolidLogoutOptions {
  logoutType?: 'app' | 'idp';
}

/**
 * WebID profile data structure
 */
export interface WebIDProfile {
  webId: string;
  name?: string;
  nickname?: string;
  email?: string;
  image?: string;
  homepage?: string;
  storage?: string[];
  oidcIssuer?: string[];
  linkedNostrDID?: string;
  linkedNostrPubkey?: string;
  preferences?: WebIDPreferences;
}

/**
 * WebID preferences
 */
export interface WebIDPreferences {
  dateCreated?: string;
  dateModified?: string;
  privateTypeIndex?: string;
  publicTypeIndex?: string;
  inbox?: string;
  preferencesFile?: string;
}

/**
 * Nostr identity link in WebID profile
 */
export interface NostrIdentityLink {
  did: string;
  pubkey: string;
  npub: string;
  verificationMethod?: string;
  linkedAt: string;
  relays?: string[];
  verified?: boolean;
}

/**
 * Solid storage container
 */
export interface SolidContainer {
  url: string;
  name: string;
  type: 'container' | 'resource';
  modified?: Date;
  size?: number;
  containedResources?: SolidResource[];
}

/**
 * Solid resource
 */
export interface SolidResource {
  url: string;
  name: string;
  type: string;
  modified?: Date;
  size?: number;
  contentType?: string;
}

/**
 * Nostr event stored as RDF
 */
export interface NostrEventRDF {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  sig: string;
  tags: string[][];
  rdfSubject?: string;
  encrypted?: boolean;
  encryptionMethod?: 'nip44' | 'nip04';
}

/**
 * Storage operation result
 */
export interface StorageResult<T = unknown> {
  success: boolean;
  data?: T;
  url?: string;
  error?: StorageError;
}

/**
 * Storage error
 */
export interface StorageError {
  code: StorageErrorCode;
  message: string;
  statusCode?: number;
  details?: unknown;
}

/**
 * Storage error codes
 */
export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_DATA'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/**
 * Pod storage paths configuration
 */
export interface PodStoragePaths {
  root: string;
  nostrEvents: string;
  encryptedEvents: string;
  profiles: string;
  messages: string;
  preferences: string;
  publicData: string;
  privateData: string;
}

/**
 * Web Access Control (WAC) mode
 */
export type ACLMode = 'Read' | 'Write' | 'Append' | 'Control';

/**
 * Access control entry
 */
export interface ACLEntry {
  subject: ACLSubject;
  modes: ACLMode[];
  resourceUrl: string;
  isDefault?: boolean;
}

/**
 * ACL subject (who gets access)
 */
export interface ACLSubject {
  type: 'agent' | 'group' | 'public' | 'authenticated';
  webId?: string;
  groupUrl?: string;
}

/**
 * Cohort to ACL mapping
 */
export interface CohortACLMapping {
  cohortName: string;
  modes: ACLMode[];
  groupUrl?: string;
  agentWebIds?: string[];
}

/**
 * Permission sync request
 */
export interface PermissionSyncRequest {
  resourceUrl: string;
  nostrPubkeys: string[];
  cohorts: string[];
  modes: ACLMode[];
}

/**
 * Permission sync result
 */
export interface PermissionSyncResult {
  success: boolean;
  resourceUrl: string;
  appliedEntries: ACLEntry[];
  errors?: ACLSyncError[];
}

/**
 * ACL sync error
 */
export interface ACLSyncError {
  pubkey: string;
  webId?: string;
  error: string;
}

/**
 * DID to WebID mapping
 */
export interface DIDWebIDMapping {
  did: string;
  webId: string;
  pubkey: string;
  linkedAt: string;
  verified: boolean;
  verificationProof?: string;
}

/**
 * Offline sync queue item
 */
export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  resourceUrl: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

/**
 * Sync state
 */
export interface SyncState {
  isOnline: boolean;
  lastSyncTimestamp: number | null;
  pendingItems: number;
  failedItems: number;
  isSyncing: boolean;
}

/**
 * RDF namespaces used in Solid
 */
export const RDF_NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  solid: 'http://www.w3.org/ns/solid/terms#',
  pim: 'http://www.w3.org/ns/pim/space#',
  ldp: 'http://www.w3.org/ns/ldp#',
  acl: 'http://www.w3.org/ns/auth/acl#',
  dc: 'http://purl.org/dc/terms/',
  schema: 'http://schema.org/',
  nostr: 'https://nostr.com/ns#',
  did: 'https://www.w3.org/ns/did#',
} as const;

/**
 * Nostr RDF vocabulary
 */
export const NOSTR_RDF_VOCAB = {
  Event: `${RDF_NAMESPACES.nostr}Event`,
  kind: `${RDF_NAMESPACES.nostr}kind`,
  pubkey: `${RDF_NAMESPACES.nostr}pubkey`,
  createdAt: `${RDF_NAMESPACES.nostr}createdAt`,
  content: `${RDF_NAMESPACES.nostr}content`,
  signature: `${RDF_NAMESPACES.nostr}signature`,
  tag: `${RDF_NAMESPACES.nostr}tag`,
  encrypted: `${RDF_NAMESPACES.nostr}encrypted`,
  encryptionMethod: `${RDF_NAMESPACES.nostr}encryptionMethod`,
  DID: `${RDF_NAMESPACES.nostr}DID`,
  relayEndpoint: `${RDF_NAMESPACES.nostr}relayEndpoint`,
} as const;

/**
 * Default pod container names
 */
export const POD_CONTAINERS = {
  NOSTR: 'nostr/',
  EVENTS: 'nostr/events/',
  ENCRYPTED: 'nostr/encrypted/',
  PROFILES: 'nostr/profiles/',
  MESSAGES: 'nostr/messages/',
  PREFERENCES: 'nostr/preferences/',
  PUBLIC: 'public/',
  PRIVATE: 'private/',
} as const;

/**
 * Configuration for Solid integration
 */
export interface SolidIntegrationConfig {
  defaultOidcIssuer: string;
  clientName: string;
  clientId?: string;
  redirectUrl: string;
  podStoragePaths: Partial<PodStoragePaths>;
  syncInterval: number;
  maxRetries: number;
  enableOfflineSync: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_SOLID_CONFIG: SolidIntegrationConfig = {
  defaultOidcIssuer: 'https://solidcommunity.net',
  clientName: 'Fairfield Nostr',
  redirectUrl: typeof window !== 'undefined' ? window.location.origin : '',
  podStoragePaths: {},
  syncInterval: 30000,
  maxRetries: 3,
  enableOfflineSync: true,
};
