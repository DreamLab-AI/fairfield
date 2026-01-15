import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getPublicKey, generateSecretKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Generate a new secp256k1 keypair for Nostr
 * @returns KeyPair with hex-encoded privateKey and publicKey
 */
export function generateKeyPair(): KeyPair {
  const secretKey = generateSecretKey();
  const privateKey = bytesToHex(secretKey);
  const publicKey = getPublicKey(secretKey);

  return { privateKey, publicKey };
}

/**
 * Encode a hex public key to npub bech32 format
 */
export function encodePubkey(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

/**
 * Encode a hex private key to nsec bech32 format
 */
export function encodePrivkey(privkey: string): string {
  return nip19.nsecEncode(hexToBytes(privkey));
}

/**
 * Restore keys from nsec bech32 or hex format
 * @param input - nsec1... or 64-character hex string
 * @returns KeyPair with hex-encoded keys
 */
export function restoreFromNsecOrHex(input: string): KeyPair {
  const trimmed = input.trim();
  let privateKey: string;

  if (trimmed.startsWith('nsec1')) {
    // Decode nsec bech32 format
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    privateKey = bytesToHex(decoded.data as Uint8Array);
  } else {
    // Assume hex format - validate it's 64 hex characters
    if (!/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      throw new Error('Invalid private key: must be 64 hex characters or nsec format');
    }
    privateKey = trimmed.toLowerCase();
  }

  const publicKey = getPublicKey(hexToBytes(privateKey));
  return { privateKey, publicKey };
}

/**
 * @deprecated SECURITY RISK - Stores keys in PLAINTEXT
 * This function is deprecated and will be removed in v2.0
 * Use authStore.setKeys() which encrypts keys with AES-256-GCM
 *
 * DO NOT USE - Kept only for migration purposes
 */
export function saveKeysToStorage(_publicKey: string, _privateKey: string): void {
  console.error(
    '[SECURITY] saveKeysToStorage is DEPRECATED and disabled. ' +
    'Use authStore.setKeys() for secure encrypted storage.'
  );
  // Intentionally disabled - do not store plaintext keys
  return;
}

/**
 * @deprecated SECURITY RISK - May return plaintext keys from legacy storage
 * Use authStore for secure key access
 * This function only exists to support migration from legacy plaintext storage
 */
export function loadKeysFromStorage(): KeyPair | null {
  if (typeof localStorage === 'undefined') return null;

  const stored = localStorage.getItem('nostr_bbs_keys');
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    // If this is legacy plaintext storage, warn and return for migration
    if (parsed.privateKey && !parsed.encryptedPrivateKey) {
      console.warn(
        '[SECURITY] Legacy plaintext keys detected. ' +
        'Please re-authenticate to migrate to encrypted storage.'
      );
      return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
    }
    // For encrypted storage, return null - use authStore instead
    return null;
  } catch {
    return null;
  }
}
