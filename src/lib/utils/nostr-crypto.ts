/**
 * Nostr cryptographic utilities
 * Simplified implementations compatible with nostr-tools
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

/**
 * Get public key from private key
 */
export function getPublicKey(privkey: string): string {
  const privkeyBytes = hexToBytes(privkey);
  const pubkeyBytes = secp256k1.getPublicKey(privkeyBytes, true);
  return bytesToHex(pubkeyBytes.slice(1)); // Remove prefix
}

/**
 * Get event hash
 */
export function getEventHash(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);

  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/**
 * Sign event
 */
export function signEvent(
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
  },
  privkey: string
): string {
  const signature = secp256k1.sign(event.id, privkey);
  return bytesToHex(signature.toCompactRawBytes());
}

/**
 * Verify event signature
 */
export function verifySignature(event: {
  id: string;
  pubkey: string;
  sig: string;
}): boolean {
  try {
    const signature = secp256k1.Signature.fromCompact(hexToBytes(event.sig));
    return secp256k1.verify(
      signature,
      hexToBytes(event.id),
      hexToBytes('02' + event.pubkey)
    );
  } catch {
    return false;
  }
}

/**
 * NIP-04 REMOVED
 *
 * NIP-04 encryption/decryption was removed on 2025-12-01 due to known security issues:
 * - No authentication (malleable ciphertext)
 * - IV reuse vulnerabilities
 * - Metadata leakage
 *
 * Use NIP-44 via gift wrap (kind 1059) for all encrypted communications.
 *
 * If you need to read historical NIP-04 encrypted messages, use an external
 * tool or archive service before they were removed.
 */

// Functions intentionally removed - not just deprecated, REMOVED.
// Compile errors are intentional to force migration to NIP-44.
