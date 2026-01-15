/**
 * DID to WebID Bridge
 *
 * Provides bidirectional mapping between Nostr DIDs (did:nostr) and Solid WebIDs.
 * Enables identity linking between Nostr's cryptographic identities and Solid's
 * web-based identity system.
 */

import { browser } from '$app/environment';
import {
  pubkeyToDID,
  didToPubkey,
  isValidNostrDID,
  generateDIDDocument,
  encodeMultikey,
  type DIDDocument,
} from '$lib/nostr/did';
import { nip19 } from 'nostr-tools';
import type {
  WebIDProfile,
  NostrIdentityLink,
  DIDWebIDMapping,
  StorageResult,
} from './types';
import { RDF_NAMESPACES, NOSTR_RDF_VOCAB } from './types';
import { getSession, getAuthenticatedFetch, fetchWebIDProfile } from './client';

/**
 * WebID bridge error
 */
export class WebIDBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'WebIDBridgeError';
  }
}

/**
 * In-memory cache for DID-WebID mappings
 */
const mappingCache = new Map<string, DIDWebIDMapping>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Convert a did:nostr identifier to a WebID-compatible format
 *
 * Creates a WebID URL that encodes the Nostr identity. This can be used
 * as a temporary WebID until a proper Solid pod is available.
 *
 * @param did - did:nostr identifier
 * @param baseUrl - Base URL for WebID generation (defaults to nostr.id)
 * @returns WebID URL string
 */
export function didToWebID(did: string, baseUrl: string = 'https://nostr.id'): string {
  if (!isValidNostrDID(did)) {
    throw new WebIDBridgeError('Invalid did:nostr format', 'INVALID_DID');
  }

  const pubkey = didToPubkey(did);
  // Generate WebID in format: https://nostr.id/users/{pubkey}#me
  return `${baseUrl.replace(/\/$/, '')}/users/${pubkey}#me`;
}

/**
 * Convert a Nostr public key to a WebID-compatible format
 *
 * @param pubkey - 64-character hex public key
 * @param baseUrl - Base URL for WebID generation
 * @returns WebID URL string
 */
export function pubkeyToWebID(pubkey: string, baseUrl: string = 'https://nostr.id'): string {
  const did = pubkeyToDID(pubkey);
  return didToWebID(did, baseUrl);
}

/**
 * Extract Nostr pubkey from a Nostr-based WebID
 *
 * @param webId - WebID URL
 * @returns Nostr public key or null if not a Nostr WebID
 */
export function webIDToPubkey(webId: string): string | null {
  try {
    const url = new URL(webId);
    // Match pattern: /users/{64-char-hex}
    const match = url.pathname.match(/\/users\/([a-f0-9]{64})/i);
    if (match) {
      return match[1].toLowerCase();
    }

    // Also check for pubkey in fragment
    if (url.hash) {
      const hashMatch = url.hash.match(/([a-f0-9]{64})/i);
      if (hashMatch) {
        return hashMatch[1].toLowerCase();
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create a WebID profile document from a Nostr public key
 *
 * Generates a Turtle-formatted WebID profile that links to the Nostr identity.
 *
 * @param pubkey - 64-character hex public key
 * @param options - Profile options
 * @returns Turtle-formatted WebID profile string
 */
export function createWebIDProfileFromPubkey(
  pubkey: string,
  options?: {
    name?: string;
    nickname?: string;
    relays?: string[];
    storage?: string;
  }
): string {
  const did = pubkeyToDID(pubkey);
  const npub = nip19.npubEncode(pubkey);
  const webId = pubkeyToWebID(pubkey);
  const multikey = encodeMultikey(pubkey);

  const lines: string[] = [
    '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
    '@prefix solid: <http://www.w3.org/ns/solid/terms#> .',
    '@prefix pim: <http://www.w3.org/ns/pim/space#> .',
    '@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .',
    '@prefix nostr: <https://nostr.com/ns#> .',
    '@prefix did: <https://www.w3.org/ns/did#> .',
    '@prefix sec: <https://w3id.org/security#> .',
    '',
    `<${webId}>`,
    '    a foaf:Person ;',
  ];

  // Add name if provided
  if (options?.name) {
    lines.push(`    foaf:name "${escapeRdfString(options.name)}" ;`);
  }

  // Add nickname if provided
  if (options?.nickname) {
    lines.push(`    foaf:nick "${escapeRdfString(options.nickname)}" ;`);
  } else {
    // Use shortened npub as default nickname
    lines.push(`    foaf:nick "${npub.slice(0, 12)}..." ;`);
  }

  // Add storage if provided
  if (options?.storage) {
    lines.push(`    pim:storage <${options.storage}> ;`);
  }

  // Add Nostr identity links
  lines.push(`    nostr:DID "${did}" ;`);
  lines.push(`    nostr:pubkey "${pubkey}" ;`);
  lines.push(`    nostr:npub "${npub}" ;`);
  lines.push(`    sec:publicKeyMultibase "${multikey}" ;`);

  // Add relay endpoints if provided
  if (options?.relays && options.relays.length > 0) {
    for (const relay of options.relays) {
      lines.push(`    nostr:relayEndpoint <${relay}> ;`);
    }
  }

  // Add DID document reference
  lines.push(`    did:alsoKnownAs "${did}" .`);

  return lines.join('\n');
}

/**
 * Escape special characters in RDF string literals
 */
function escapeRdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Link a Nostr identity to an existing WebID profile
 *
 * Updates the user's WebID profile document to include their Nostr DID
 * as an alternative identity.
 *
 * @param pubkey - Nostr public key to link
 * @param relays - Optional relay endpoints
 * @returns Storage result with updated profile
 */
export async function linkNostrIdentityToWebID(
  pubkey: string,
  relays?: string[]
): Promise<StorageResult<NostrIdentityLink>> {
  const session = getSession();

  if (!session.isLoggedIn || !session.webId) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to Solid to link identity',
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

  try {
    const did = pubkeyToDID(pubkey);
    const npub = nip19.npubEncode(pubkey);
    const multikey = encodeMultikey(pubkey);

    // Build SPARQL UPDATE to add Nostr identity triples
    const sparqlUpdate = `
      PREFIX nostr: <${RDF_NAMESPACES.nostr}>
      PREFIX sec: <https://w3id.org/security#>
      PREFIX did: <${RDF_NAMESPACES.did}>
      PREFIX dc: <${RDF_NAMESPACES.dc}>

      INSERT DATA {
        <${session.webId}> nostr:DID "${did}" .
        <${session.webId}> nostr:pubkey "${pubkey}" .
        <${session.webId}> nostr:npub "${npub}" .
        <${session.webId}> sec:publicKeyMultibase "${multikey}" .
        <${session.webId}> dc:modified "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        ${relays?.map(r => `<${session.webId}> nostr:relayEndpoint <${r}> .`).join('\n') || ''}
      }
    `;

    const response = await fetchFn(session.webId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/sparql-update',
      },
      body: sparqlUpdate,
    });

    if (!response.ok) {
      // If PATCH fails, try PUT with full profile
      return await replaceProfileWithNostrLink(session.webId, pubkey, relays, fetchFn);
    }

    const link: NostrIdentityLink = {
      did,
      pubkey,
      npub,
      verificationMethod: `${did}#key-0`,
      linkedAt: new Date().toISOString(),
      relays,
    };

    // Update cache
    const mapping: DIDWebIDMapping = {
      did,
      webId: session.webId,
      pubkey,
      linkedAt: link.linkedAt,
      verified: true,
    };
    mappingCache.set(did, mapping);
    mappingCache.set(session.webId, mapping);
    cacheTimestamps.set(did, Date.now());
    cacheTimestamps.set(session.webId, Date.now());

    return {
      success: true,
      data: link,
      url: session.webId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Failed to link identity',
        details: error,
      },
    };
  }
}

/**
 * Replace profile with full document including Nostr link
 */
async function replaceProfileWithNostrLink(
  webId: string,
  pubkey: string,
  relays: string[] | undefined,
  fetchFn: typeof fetch
): Promise<StorageResult<NostrIdentityLink>> {
  try {
    // Fetch existing profile
    const existingProfile = await fetchWebIDProfile(webId);

    // Create new profile content with Nostr link
    const profileContent = createWebIDProfileFromPubkey(pubkey, {
      name: existingProfile?.name,
      nickname: existingProfile?.nickname,
      relays,
      storage: existingProfile?.storage?.[0],
    });

    const response = await fetchFn(webId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: profileContent,
    });

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN',
          message: `Failed to update profile: ${response.status}`,
          statusCode: response.status,
        },
      };
    }

    const did = pubkeyToDID(pubkey);
    const npub = nip19.npubEncode(pubkey);

    return {
      success: true,
      data: {
        did,
        pubkey,
        npub,
        verificationMethod: `${did}#key-0`,
        linkedAt: new Date().toISOString(),
        relays,
      },
      url: webId,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Failed to replace profile',
        details: error,
      },
    };
  }
}

/**
 * Get linked Nostr identity from a WebID profile
 *
 * @param webId - WebID to check
 * @returns NostrIdentityLink if found, null otherwise
 */
export async function getLinkedNostrIdentity(webId?: string): Promise<NostrIdentityLink | null> {
  const targetWebId = webId || getSession().webId;

  if (!targetWebId) {
    return null;
  }

  // Check cache
  const cached = mappingCache.get(targetWebId);
  const timestamp = cacheTimestamps.get(targetWebId);
  if (cached && timestamp && Date.now() - timestamp < CACHE_TTL) {
    return {
      did: cached.did,
      pubkey: cached.pubkey,
      npub: nip19.npubEncode(cached.pubkey),
      linkedAt: cached.linkedAt,
      verified: cached.verified,
    };
  }

  try {
    const profile = await fetchWebIDProfile(targetWebId);

    if (!profile?.linkedNostrDID) {
      return null;
    }

    const link: NostrIdentityLink = {
      did: profile.linkedNostrDID,
      pubkey: profile.linkedNostrPubkey || didToPubkey(profile.linkedNostrDID),
      npub: nip19.npubEncode(profile.linkedNostrPubkey || didToPubkey(profile.linkedNostrDID)),
      linkedAt: new Date().toISOString(),
    };

    // Update cache
    const mapping: DIDWebIDMapping = {
      did: link.did,
      webId: targetWebId,
      pubkey: link.pubkey,
      linkedAt: link.linkedAt,
      verified: true,
    };
    mappingCache.set(link.did, mapping);
    mappingCache.set(targetWebId, mapping);
    cacheTimestamps.set(link.did, Date.now());
    cacheTimestamps.set(targetWebId, Date.now());

    return link;
  } catch (error) {
    console.error('[WebIDBridge] Failed to get linked identity:', error);
    return null;
  }
}

/**
 * Verify that a WebID is linked to a specific Nostr identity
 *
 * @param webId - WebID to verify
 * @param pubkey - Expected Nostr public key
 * @returns true if the WebID is verified to link to the pubkey
 */
export async function verifyWebIDNostrLink(webId: string, pubkey: string): Promise<boolean> {
  try {
    const link = await getLinkedNostrIdentity(webId);

    if (!link) {
      return false;
    }

    return link.pubkey.toLowerCase() === pubkey.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Resolve a did:nostr to a WebID if a mapping exists
 *
 * @param did - did:nostr identifier
 * @returns WebID URL or null if no mapping found
 */
export async function resolveNostrDIDToWebID(did: string): Promise<string | null> {
  if (!isValidNostrDID(did)) {
    return null;
  }

  // Check cache first
  const cached = mappingCache.get(did);
  const timestamp = cacheTimestamps.get(did);
  if (cached && timestamp && Date.now() - timestamp < CACHE_TTL) {
    return cached.webId;
  }

  // For now, generate synthetic WebID
  // In a full implementation, this would query a registry or resolver
  return didToWebID(did);
}

/**
 * Resolve a WebID to a did:nostr if the profile has a linked Nostr identity
 *
 * @param webId - WebID URL
 * @returns did:nostr identifier or null if no Nostr identity linked
 */
export async function resolveWebIDToNostrDID(webId: string): Promise<string | null> {
  const link = await getLinkedNostrIdentity(webId);
  return link?.did || null;
}

/**
 * Create a DID Document that references both the did:nostr and WebID
 *
 * This creates an interoperable identity document that works in both
 * Nostr and Solid ecosystems.
 *
 * @param pubkey - Nostr public key
 * @param webId - Solid WebID
 * @param relays - Optional Nostr relay endpoints
 * @returns Unified DID Document
 */
export function createUnifiedDIDDocument(
  pubkey: string,
  webId: string,
  relays?: string[]
): DIDDocument & { alsoKnownAs: string[] } {
  const baseDIDDoc = generateDIDDocument(pubkey, { relays, includeNip19: true });

  return {
    ...baseDIDDoc,
    alsoKnownAs: [
      webId,
      `nostr:${nip19.npubEncode(pubkey)}`,
    ],
    service: [
      ...(baseDIDDoc.service || []),
      {
        id: `${baseDIDDoc.id}#solid-webid`,
        type: 'SolidWebID',
        serviceEndpoint: webId,
      },
    ],
  };
}

/**
 * Register a DID-WebID mapping in the cache
 *
 * @param mapping - The mapping to register
 */
export function registerMapping(mapping: DIDWebIDMapping): void {
  mappingCache.set(mapping.did, mapping);
  mappingCache.set(mapping.webId, mapping);
  cacheTimestamps.set(mapping.did, Date.now());
  cacheTimestamps.set(mapping.webId, Date.now());
}

/**
 * Clear mapping cache
 */
export function clearMappingCache(): void {
  mappingCache.clear();
  cacheTimestamps.clear();
}

/**
 * Get all cached mappings
 */
export function getCachedMappings(): DIDWebIDMapping[] {
  const seen = new Set<string>();
  const mappings: DIDWebIDMapping[] = [];

  for (const mapping of mappingCache.values()) {
    const key = `${mapping.did}:${mapping.webId}`;
    if (!seen.has(key)) {
      seen.add(key);
      mappings.push(mapping);
    }
  }

  return mappings;
}

export default {
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
};
