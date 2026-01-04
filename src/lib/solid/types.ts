/**
 * Solid Pod Integration Types
 * TypeScript definitions for Solid pod operations with NIP-98 auth
 */

/**
 * Configuration for the Solid client
 */
export interface SolidClientConfig {
  /** Base URL of the Solid server */
  serverUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for failed requests */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * User identity for Solid operations
 */
export interface SolidIdentity {
  /** Hex-encoded public key */
  pubkey: string;
  /** Hex-encoded private key for signing */
  privateKey: string;
  /** Bech32-encoded public key (npub) */
  npub: string;
}

/**
 * Pod information
 */
export interface PodInfo {
  /** Pod name/identifier */
  name: string;
  /** Full WebID URL */
  webId: string;
  /** Pod root URL */
  podUrl: string;
  /** Whether the pod exists */
  exists: boolean;
  /** Storage quota in bytes (if available) */
  quota?: number;
  /** Used storage in bytes (if available) */
  used?: number;
  /** Creation timestamp */
  createdAt?: number;
}

/**
 * Pod provisioning result
 */
export interface PodProvisionResult {
  success: boolean;
  podInfo?: PodInfo;
  error?: string;
  /** Whether the pod already existed */
  alreadyExists?: boolean;
}

/**
 * NIP-98 HTTP Auth event structure
 */
export interface Nip98AuthEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 27235;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * NIP-98 auth options
 */
export interface Nip98AuthOptions {
  /** Target URL for the request */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request body hash (SHA-256, for POST/PUT/PATCH) */
  payload?: string;
}

/**
 * File metadata for uploads
 */
export interface FileMetadata {
  /** File name */
  name: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified?: number;
  /** Custom metadata */
  custom?: Record<string, string>;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  /** Target path within the pod (e.g., '/files/image.png') */
  path: string;
  /** Content type override */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
}

/**
 * File upload result
 */
export interface FileUploadResult {
  success: boolean;
  /** URL of the uploaded file */
  url?: string;
  /** ETag for the file */
  etag?: string;
  /** File metadata */
  metadata?: FileMetadata;
  error?: string;
}

/**
 * File download result
 */
export interface FileDownloadResult {
  success: boolean;
  /** File data as Blob */
  data?: Blob;
  /** File metadata */
  metadata?: FileMetadata;
  /** ETag */
  etag?: string;
  error?: string;
}

/**
 * Resource (file/container) info
 */
export interface ResourceInfo {
  /** Resource URL */
  url: string;
  /** Resource name */
  name: string;
  /** Whether it's a container */
  isContainer: boolean;
  /** Content type */
  contentType?: string;
  /** Size in bytes */
  size?: number;
  /** Last modified timestamp */
  modified?: number;
  /** ETag */
  etag?: string;
}

/**
 * Container listing result
 */
export interface ContainerListResult {
  success: boolean;
  /** Container URL */
  containerUrl?: string;
  /** Resources in container */
  resources?: ResourceInfo[];
  error?: string;
}

/**
 * JSON-LD resource for RDF operations
 */
export interface JsonLdResource {
  '@context'?: string | Record<string, unknown> | (string | Record<string, unknown>)[];
  '@id'?: string;
  '@type'?: string | string[];
  [key: string]: unknown;
}

/**
 * JSON-LD operation result
 */
export interface JsonLdResult {
  success: boolean;
  data?: JsonLdResource;
  url?: string;
  error?: string;
}

/**
 * ACL permission types
 */
export type AclMode = 'Read' | 'Write' | 'Append' | 'Control';

/**
 * ACL entry
 */
export interface AclEntry {
  /** Agent (WebID or agentClass) */
  agent: string;
  /** Granted modes */
  modes: AclMode[];
  /** Whether this is for the default ACL */
  isDefault?: boolean;
}

/**
 * ACL update options
 */
export interface AclUpdateOptions {
  /** Resource URL */
  resourceUrl: string;
  /** ACL entries */
  entries: AclEntry[];
  /** Whether to make resource public (adds public agent) */
  public?: boolean;
}

/**
 * Request options with auth
 */
export interface AuthenticatedRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: BodyInit;
  identity: SolidIdentity;
}

/**
 * HTTP response wrapper
 */
export interface SolidResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  body?: unknown;
}

/**
 * Error types for Solid operations
 */
export enum SolidErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error for Solid operations
 */
export class SolidError extends Error {
  constructor(
    message: string,
    public type: SolidErrorType,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SolidError';
  }
}
