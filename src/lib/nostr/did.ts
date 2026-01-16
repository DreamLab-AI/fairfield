/**
 * DID:NOSTR Implementation
 *
 * Implements the did:nostr method specification for W3C Decentralized Identifiers.
 * @see https://nostrcg.github.io/did-nostr/
 * @see https://www.w3.org/TR/did-extensions-methods/
 *
 * Format: did:nostr:<64-character-hex-pubkey>
 *
 * This module provides:
 * - DID string generation from Nostr public keys
 * - DID Document generation per W3C DID Core spec
 * - Multikey encoding with multicodec prefix (0xe7, 0x01 for secp256k1)
 * - DID URL parsing and resolution
 */

import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { nip19 } from 'nostr-tools';

// Multicodec prefix for secp256k1-pub (0xe7, 0x01)
const SECP256K1_MULTICODEC_PREFIX = new Uint8Array([0xe7, 0x01]);

// Base58btc alphabet for multibase encoding
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * DID Document interface per W3C DID Core specification
 */
export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: ServiceEndpoint[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyHex?: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | string[];
}

/**
 * DID Resolution Result per DID Resolution specification
 */
export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didResolutionMetadata: {
    contentType?: string;
    error?: string;
    errorMessage?: string;
  };
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
  };
}

/**
 * Convert a 64-character hex public key to did:nostr format
 *
 * @param pubkey - 64-character hex public key
 * @returns did:nostr:<pubkey> string
 * @throws Error if pubkey is invalid
 */
export function pubkeyToDID(pubkey: string): string {
  const normalized = pubkey.toLowerCase().trim();

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('Invalid pubkey: must be 64 lowercase hex characters');
  }

  return `did:nostr:${normalized}`;
}

/**
 * Extract public key from did:nostr string
 *
 * @param did - did:nostr:<pubkey> string
 * @returns 64-character hex public key
 * @throws Error if DID format is invalid
 */
export function didToPubkey(did: string): string {
  const match = did.match(/^did:nostr:([a-f0-9]{64})$/i);

  if (!match) {
    throw new Error('Invalid did:nostr format. Expected: did:nostr:<64-hex-chars>');
  }

  return match[1].toLowerCase();
}

/**
 * Check if a string is a valid did:nostr identifier
 *
 * @param did - String to validate
 * @returns true if valid did:nostr format
 */
export function isValidNostrDID(did: string): boolean {
  return /^did:nostr:[a-f0-9]{64}$/i.test(did);
}

/**
 * Encode bytes to base58btc (multibase 'z' prefix)
 */
function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  let result = '';
  while (num > 0) {
    const remainder = num % BigInt(58);
    result = BASE58_ALPHABET[Number(remainder)] + result;
    num = num / BigInt(58);
  }

  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }

  return result || '1';
}

/**
 * Decode base58btc string to bytes
 */
function decodeBase58(str: string): Uint8Array {
  let num = BigInt(0);
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    num = num * BigInt(58) + BigInt(index);
  }

  const bytes: number[] = [];
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  // Handle leading '1's (zeros)
  for (const char of str) {
    if (char === '1') {
      bytes.unshift(0);
    } else {
      break;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode public key as Multikey format with multibase encoding
 *
 * Multikey format: multibase(multicodec-prefix + raw-public-key)
 * For secp256k1: z + base58btc(0xe7 0x01 + 32-byte-pubkey)
 *
 * @param pubkey - 64-character hex public key
 * @returns Multibase-encoded Multikey string (starts with 'z')
 */
export function encodeMultikey(pubkey: string): string {
  const pubkeyBytes = hexToBytes(pubkey);

  // Concatenate multicodec prefix with public key
  const multikey = new Uint8Array(SECP256K1_MULTICODEC_PREFIX.length + pubkeyBytes.length);
  multikey.set(SECP256K1_MULTICODEC_PREFIX, 0);
  multikey.set(pubkeyBytes, SECP256K1_MULTICODEC_PREFIX.length);

  // Encode as base58btc with 'z' multibase prefix
  return 'z' + encodeBase58(multikey);
}

/**
 * Decode Multikey format back to hex public key
 *
 * @param multikey - Multibase-encoded Multikey string
 * @returns 64-character hex public key
 * @throws Error if format is invalid
 */
export function decodeMultikey(multikey: string): string {
  if (!multikey.startsWith('z')) {
    throw new Error('Invalid Multikey: must start with "z" (base58btc multibase prefix)');
  }

  const decoded = decodeBase58(multikey.slice(1));

  // Verify multicodec prefix
  if (decoded[0] !== 0xe7 || decoded[1] !== 0x01) {
    throw new Error('Invalid Multikey: incorrect multicodec prefix for secp256k1');
  }

  // Extract public key bytes (skip 2-byte prefix)
  const pubkeyBytes = decoded.slice(2);

  if (pubkeyBytes.length !== 32) {
    throw new Error('Invalid Multikey: public key must be 32 bytes');
  }

  return bytesToHex(pubkeyBytes);
}

/**
 * Generate a DID Document for a Nostr public key
 *
 * Creates a W3C-compliant DID Document with:
 * - Verification method using Multikey format
 * - Authentication, assertion, and key agreement references
 * - Optional Nostr relay service endpoints
 *
 * @param pubkey - 64-character hex public key
 * @param options - Optional configuration
 * @returns DID Document object
 */
export function generateDIDDocument(
  pubkey: string,
  options?: {
    relays?: string[];
    includeNip19?: boolean;
  }
): DIDDocument {
  const did = pubkeyToDID(pubkey);
  const keyId = `${did}#key-0`;
  const multikey = encodeMultikey(pubkey);

  const document: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1',
      'https://w3id.org/security/data-integrity/v2'
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: multikey
      }
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    capabilityInvocation: [keyId],
    capabilityDelegation: [keyId]
  };

  // Add Nostr relay service endpoints if provided
  if (options?.relays && options.relays.length > 0) {
    document.service = [
      {
        id: `${did}#nostr-relays`,
        type: 'NostrRelay',
        serviceEndpoint: options.relays
      }
    ];
  }

  // Optionally include NIP-19 encoded forms as alternative verification method
  if (options?.includeNip19) {
    const npub = nip19.npubEncode(pubkey);
    document.verificationMethod.push({
      id: `${did}#npub`,
      type: 'Nip19EncodedKey',
      controller: did,
      publicKeyHex: pubkey
    });

    // Add alsoKnownAs with npub
    (document as DIDDocument & { alsoKnownAs?: string[] }).alsoKnownAs = [
      `nostr:${npub}`
    ];
  }

  return document;
}

/**
 * Resolve a did:nostr identifier to a DID Document
 *
 * This is a local resolution - it generates the DID Document from the pubkey.
 * For full resolution including relay metadata, additional network calls would be needed.
 *
 * @param did - did:nostr:<pubkey> string
 * @param options - Resolution options
 * @returns DID Resolution Result
 */
export function resolveDID(
  did: string,
  options?: {
    relays?: string[];
  }
): DIDResolutionResult {
  try {
    if (!isValidNostrDID(did)) {
      return {
        didDocument: null,
        didResolutionMetadata: {
          error: 'invalidDid',
          errorMessage: 'Invalid did:nostr format'
        },
        didDocumentMetadata: {}
      };
    }

    const pubkey = didToPubkey(did);
    const document = generateDIDDocument(pubkey, { relays: options?.relays });

    return {
      didDocument: document,
      didResolutionMetadata: {
        contentType: 'application/did+json'
      },
      didDocumentMetadata: {
        created: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      didDocument: null,
      didResolutionMetadata: {
        error: 'internalError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      },
      didDocumentMetadata: {}
    };
  }
}

/**
 * Convert npub (NIP-19) to did:nostr format
 *
 * @param npub - NIP-19 encoded public key (npub1...)
 * @returns did:nostr:<pubkey> string
 */
export function npubToDID(npub: string): string {
  const decoded = nip19.decode(npub);

  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format');
  }

  return pubkeyToDID(decoded.data as string);
}

/**
 * Convert did:nostr to npub (NIP-19) format
 *
 * @param did - did:nostr:<pubkey> string
 * @returns NIP-19 encoded public key (npub1...)
 */
export function didToNpub(did: string): string {
  const pubkey = didToPubkey(did);
  return nip19.npubEncode(pubkey);
}

/**
 * Create a minimal DID Document for authentication purposes
 *
 * @param pubkey - 64-character hex public key
 * @returns Minimal DID Document suitable for authentication
 */
export function createAuthenticationDIDDocument(pubkey: string): DIDDocument {
  const did = pubkeyToDID(pubkey);
  const keyId = `${did}#key-0`;

  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: encodeMultikey(pubkey)
      }
    ],
    authentication: [keyId]
  };
}

/**
 * Verify that a DID Document is valid for a given pubkey
 *
 * @param document - DID Document to verify
 * @param pubkey - Expected public key
 * @returns true if document is valid for pubkey
 */
export function verifyDIDDocument(document: DIDDocument, pubkey: string): boolean {
  try {
    const expectedDID = pubkeyToDID(pubkey);

    // Check DID matches
    if (document.id !== expectedDID) {
      return false;
    }

    // Check at least one verification method with correct key
    const hasValidKey = document.verificationMethod.some(vm => {
      if (vm.publicKeyMultibase) {
        try {
          const decodedPubkey = decodeMultikey(vm.publicKeyMultibase);
          return decodedPubkey === pubkey;
        } catch {
          return false;
        }
      }
      if (vm.publicKeyHex) {
        return vm.publicKeyHex.toLowerCase() === pubkey.toLowerCase();
      }
      return false;
    });

    return hasValidKey;
  } catch {
    return false;
  }
}
