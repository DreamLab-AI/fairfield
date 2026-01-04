/**
 * Solid Pod Client with NIP-98 Authentication
 * Core HTTP client for Solid pod operations
 */

import { finalizeEvent, nip19, type EventTemplate } from 'nostr-tools';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha256';
import type {
  SolidClientConfig,
  SolidIdentity,
  Nip98AuthEvent,
  Nip98AuthOptions,
  AuthenticatedRequestOptions,
  SolidResponse,
} from './types';
import { SolidError, SolidErrorType } from './types';

/** NIP-98 event kind for HTTP auth */
const NIP98_KIND = 27235;

/** Default configuration */
const DEFAULT_CONFIG: Required<Omit<SolidClientConfig, 'serverUrl'>> = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Get the Solid server URL from environment or config
 */
export function getSolidServerUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOLID_SERVER_URL) {
    return import.meta.env.VITE_SOLID_SERVER_URL;
  }
  // Default for Docker internal network
  return 'http://solid-server:3030';
}

/**
 * Create a SolidIdentity from Nostr keys
 */
export function createSolidIdentity(pubkey: string, privateKey: string): SolidIdentity {
  return {
    pubkey,
    privateKey,
    npub: nip19.npubEncode(pubkey),
  };
}

/**
 * Get current Unix timestamp in seconds
 */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Compute SHA-256 hash of data
 */
function computeSha256(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  return bytesToHex(sha256(bytes));
}

/**
 * Create a NIP-98 HTTP Auth event
 *
 * NIP-98 specifies:
 * - kind: 27235
 * - tags: [["u", <url>], ["method", <method>], ["payload", <sha256 hash>]]
 * - content: empty
 * - created_at: within acceptable time window
 */
export function createNip98AuthEvent(
  identity: SolidIdentity,
  options: Nip98AuthOptions
): Nip98AuthEvent {
  const tags: string[][] = [
    ['u', options.url],
    ['method', options.method],
  ];

  // Add payload hash for POST/PUT/PATCH requests
  if (options.payload && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    tags.push(['payload', options.payload]);
  }

  const eventTemplate: EventTemplate = {
    kind: NIP98_KIND,
    created_at: nowSeconds(),
    tags,
    content: '',
  };

  const privateKeyBytes = hexToBytes(identity.privateKey);
  const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

  return signedEvent as Nip98AuthEvent;
}

/**
 * Encode NIP-98 auth event to base64 for Authorization header
 */
export function encodeNip98Auth(event: Nip98AuthEvent): string {
  const json = JSON.stringify(event);
  // Use btoa for browser, Buffer for Node.js
  if (typeof btoa !== 'undefined') {
    return btoa(json);
  }
  return Buffer.from(json).toString('base64');
}

/**
 * Create Authorization header value for NIP-98
 */
export function createAuthorizationHeader(
  identity: SolidIdentity,
  options: Nip98AuthOptions
): string {
  const event = createNip98AuthEvent(identity, options);
  const encoded = encodeNip98Auth(event);
  return `Nostr ${encoded}`;
}

/**
 * Solid Pod HTTP Client
 */
export class SolidClient {
  private config: Required<SolidClientConfig>;

  constructor(config: Partial<SolidClientConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || getSolidServerUrl(),
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Get the configured server URL
   */
  get serverUrl(): string {
    return this.config.serverUrl;
  }

  /**
   * Build full URL from path
   */
  buildUrl(path: string): string {
    const base = this.config.serverUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  /**
   * Compute payload hash for body content
   */
  private async computePayloadHash(body: BodyInit | undefined): Promise<string | undefined> {
    if (!body) return undefined;

    if (typeof body === 'string') {
      return computeSha256(body);
    }

    if (body instanceof ArrayBuffer) {
      return computeSha256(body);
    }

    if (body instanceof Blob) {
      const buffer = await body.arrayBuffer();
      return computeSha256(buffer);
    }

    if (body instanceof FormData) {
      // For FormData, we need to serialize it
      // This is a simplified approach - in production you might need more robust handling
      const text = JSON.stringify(Object.fromEntries(body.entries()));
      return computeSha256(text);
    }

    // For other types, try to convert to string
    return computeSha256(String(body));
  }

  /**
   * Make an authenticated request to the Solid server
   */
  async request(options: AuthenticatedRequestOptions): Promise<SolidResponse> {
    const { url, method, headers = {}, body, identity } = options;

    // Compute payload hash for non-GET requests
    const payloadHash = ['POST', 'PUT', 'PATCH'].includes(method)
      ? await this.computePayloadHash(body)
      : undefined;

    // Create NIP-98 auth header
    const authHeader = createAuthorizationHeader(identity, {
      url,
      method,
      payload: payloadHash,
    });

    const requestHeaders: Record<string, string> = {
      Authorization: authHeader,
      ...headers,
    };

    // Set content type if body exists and not already set
    if (body && !requestHeaders['Content-Type']) {
      if (typeof body === 'string') {
        // Try to detect JSON
        try {
          JSON.parse(body);
          requestHeaders['Content-Type'] = 'application/ld+json';
        } catch {
          requestHeaders['Content-Type'] = 'text/plain';
        }
      }
    }

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response body based on content type
        let responseBody: unknown;
        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json') || contentType.includes('application/ld+json')) {
          responseBody = await response.json();
        } else if (contentType.includes('text/')) {
          responseBody = await response.text();
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: responseBody,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new SolidError('Request timeout', SolidErrorType.TIMEOUT);
        }

        // Retry on network errors
        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          attempt++;
          continue;
        }

        throw new SolidError(
          `Network error: ${lastError.message}`,
          SolidErrorType.NETWORK_ERROR,
          undefined,
          lastError
        );
      }
    }

    throw new SolidError(
      `Request failed after ${this.config.maxRetries} attempts`,
      SolidErrorType.NETWORK_ERROR,
      undefined,
      lastError
    );
  }

  /**
   * Make a GET request
   */
  async get(
    path: string,
    identity: SolidIdentity,
    headers?: Record<string, string>
  ): Promise<SolidResponse> {
    return this.request({
      url: this.buildUrl(path),
      method: 'GET',
      identity,
      headers,
    });
  }

  /**
   * Make a POST request
   */
  async post(
    path: string,
    identity: SolidIdentity,
    body?: BodyInit,
    headers?: Record<string, string>
  ): Promise<SolidResponse> {
    return this.request({
      url: this.buildUrl(path),
      method: 'POST',
      identity,
      body,
      headers,
    });
  }

  /**
   * Make a PUT request
   */
  async put(
    path: string,
    identity: SolidIdentity,
    body?: BodyInit,
    headers?: Record<string, string>
  ): Promise<SolidResponse> {
    return this.request({
      url: this.buildUrl(path),
      method: 'PUT',
      identity,
      body,
      headers,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(
    path: string,
    identity: SolidIdentity,
    headers?: Record<string, string>
  ): Promise<SolidResponse> {
    return this.request({
      url: this.buildUrl(path),
      method: 'DELETE',
      identity,
      headers,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch(
    path: string,
    identity: SolidIdentity,
    body?: BodyInit,
    headers?: Record<string, string>
  ): Promise<SolidResponse> {
    return this.request({
      url: this.buildUrl(path),
      method: 'PATCH',
      identity,
      body,
      headers,
    });
  }

  /**
   * Map HTTP status to error type
   */
  static mapStatusToErrorType(status: number): SolidErrorType {
    switch (status) {
      case 401:
        return SolidErrorType.AUTH_ERROR;
      case 403:
        return SolidErrorType.FORBIDDEN;
      case 404:
        return SolidErrorType.NOT_FOUND;
      case 409:
        return SolidErrorType.CONFLICT;
      case 400:
      case 422:
        return SolidErrorType.INVALID_REQUEST;
      default:
        if (status >= 500) {
          return SolidErrorType.SERVER_ERROR;
        }
        return SolidErrorType.UNKNOWN;
    }
  }

  /**
   * Throw appropriate error for failed response
   */
  static throwForResponse(response: SolidResponse, message?: string): never {
    const errorType = SolidClient.mapStatusToErrorType(response.status);
    throw new SolidError(
      message || `HTTP ${response.status}: ${response.statusText}`,
      errorType,
      response.status,
      response.body
    );
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a default Solid client instance
 */
export function createSolidClient(config?: Partial<SolidClientConfig>): SolidClient {
  return new SolidClient(config);
}

/**
 * Singleton client instance for convenience
 */
let defaultClient: SolidClient | null = null;

export function getDefaultClient(): SolidClient {
  if (!defaultClient) {
    defaultClient = createSolidClient();
  }
  return defaultClient;
}

export function setDefaultClient(client: SolidClient): void {
  defaultClient = client;
}
