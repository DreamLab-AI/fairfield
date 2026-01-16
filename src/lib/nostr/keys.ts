import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getPublicKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

const NIP06_PATH = "m/44'/1237'/0'/0/0";

export interface KeyPair {
  mnemonic: string;
  privateKey: string;
  publicKey: string;
}

export async function generateNewIdentity(): Promise<KeyPair> {
  const mnemonic = generateMnemonic(wordlist, 128);
  const seed = await mnemonicToSeed(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = getPublicKey(hexToBytes(privateKey));

  return { mnemonic, privateKey, publicKey };
}

/**
 * Generate keys without mnemonic - simpler onboarding
 * Uses crypto.getRandomValues for secure random key generation
 */
export function generateSimpleKeys(): { privateKey: string; publicKey: string } {
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  const privateKey = bytesToHex(privateKeyBytes);
  const publicKey = getPublicKey(privateKeyBytes);
  return { privateKey, publicKey };
}

export async function restoreFromMnemonic(mnemonic: string): Promise<Omit<KeyPair, 'mnemonic'>> {
  if (!validateMnemonic(mnemonic.trim(), wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = await mnemonicToSeed(mnemonic.trim(), '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = getPublicKey(hexToBytes(privateKey));

  return { privateKey, publicKey };
}

export function encodePubkey(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

export function encodePrivkey(privkey: string): string {
  return nip19.nsecEncode(hexToBytes(privkey));
}

export function restoreFromNsecOrHex(input: string): { privateKey: string; publicKey: string } {
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
 * Generate a new keypair - alias for generateSimpleKeys
 * @returns Object with privateKey and publicKey in hex format
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  return generateSimpleKeys();
}

/**
 * @deprecated DISABLED - Plaintext key storage is a security risk.
 * Use authStore.setKeys() instead for encrypted session storage.
 * This function is a no-op for security reasons.
 */
export function saveKeysToStorage(_publicKey: string, _privateKey: string): void {
  console.error(
    '[SECURITY] saveKeysToStorage is DEPRECATED and disabled. ' +
    'Plaintext key storage is a security risk. ' +
    'Use authStore.setKeys() for encrypted session storage.'
  );
}

/**
 * @deprecated Load keys from legacy plaintext localStorage.
 * Returns null for encrypted storage format - use authStore instead.
 * Only returns keys if legacy plaintext format is detected (for migration).
 */
export function loadKeysFromStorage(): { publicKey: string; privateKey: string } | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem('nostr_bbs_keys');
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);

    // Return null for encrypted storage format - should use authStore
    if (parsed.encryptedPrivateKey || !parsed.publicKey || !parsed.privateKey) {
      return null;
    }

    // Legacy plaintext format detected - warn and return for migration
    console.warn(
      '[SECURITY] Legacy plaintext keys detected in localStorage. ' +
      'Please re-authenticate to migrate to encrypted storage.'
    );

    return {
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey
    };
  } catch {
    return null;
  }
}
