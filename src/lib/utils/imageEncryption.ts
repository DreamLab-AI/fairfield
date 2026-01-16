/**
 * Image Encryption Utilities
 * Client-side encryption for private image storage using AES-256-GCM
 * with NIP-44 key distribution for recipients
 */

import { nip44 } from 'nostr-tools';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { getPublicKey } from 'nostr-tools/pure';

// AES-256-GCM parameters
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

/**
 * Encrypted image data structure
 */
export interface EncryptedImageData {
  /** Base64-encoded encrypted blob (includes salt + iv + ciphertext) */
  encryptedBlob: ArrayBuffer;
  /** Base64-encoded IV for decryption */
  iv: string;
  /** Base64-encoded salt */
  salt: string;
}

/**
 * Per-recipient encrypted key
 */
export interface RecipientKey {
  pubkey: string;
  encryptedKey: string; // NIP-44 encrypted AES key
}

/**
 * Full encrypted image package for Nostr event
 */
export interface EncryptedImagePackage {
  /** Encrypted image blob as ArrayBuffer */
  encryptedBlob: ArrayBuffer;
  /** Base64 IV */
  iv: string;
  /** Base64 salt */
  salt: string;
  /** Per-recipient encrypted AES keys */
  recipientKeys: RecipientKey[];
}

/**
 * Error class for encryption operations
 */
export class ImageEncryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ImageEncryptionError';
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isImageEncryptionAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues !== 'undefined'
  );
}

/**
 * Generate a random AES-256 key for image encryption
 * Returns the raw key bytes (32 bytes)
 */
export async function generateImageKey(): Promise<Uint8Array> {
  if (!isImageEncryptionAvailable()) {
    throw new ImageEncryptionError(
      'Web Crypto API not available',
      'CRYPTO_UNAVAILABLE'
    );
  }

  // Generate 32 bytes (256 bits) of random data
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return keyBytes;
}

/**
 * Import raw key bytes as CryptoKey for AES-GCM
 */
async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  // Create a new ArrayBuffer to ensure TypeScript compatibility
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an image blob with AES-256-GCM
 * @param blob - Image blob to encrypt
 * @param keyBytes - 32-byte AES key
 * @returns Encrypted data with IV and salt
 */
export async function encryptImageBlob(
  blob: Blob,
  keyBytes: Uint8Array
): Promise<EncryptedImageData> {
  if (!isImageEncryptionAvailable()) {
    throw new ImageEncryptionError(
      'Web Crypto API not available',
      'CRYPTO_UNAVAILABLE'
    );
  }

  if (keyBytes.length !== 32) {
    throw new ImageEncryptionError(
      'Key must be 32 bytes (256 bits)',
      'INVALID_KEY_LENGTH'
    );
  }

  // Generate random IV and salt
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import key
  const cryptoKey = await importKey(keyBytes);

  // Read blob as ArrayBuffer
  const plaintext = await blob.arrayBuffer();

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(
    salt.length + iv.length + ciphertext.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return {
    encryptedBlob: combined.buffer,
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

/**
 * Decrypt an encrypted image blob
 * @param encryptedData - Combined salt + iv + ciphertext as ArrayBuffer
 * @param keyBytes - 32-byte AES key
 * @returns Decrypted blob
 */
export async function decryptImageBlob(
  encryptedData: ArrayBuffer,
  keyBytes: Uint8Array
): Promise<Blob> {
  if (!isImageEncryptionAvailable()) {
    throw new ImageEncryptionError(
      'Web Crypto API not available',
      'CRYPTO_UNAVAILABLE'
    );
  }

  if (keyBytes.length !== 32) {
    throw new ImageEncryptionError(
      'Key must be 32 bytes (256 bits)',
      'INVALID_KEY_LENGTH'
    );
  }

  const dataArray = new Uint8Array(encryptedData);

  // Extract salt, iv, and ciphertext
  const salt = dataArray.slice(0, SALT_LENGTH);
  const iv = dataArray.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = dataArray.slice(SALT_LENGTH + IV_LENGTH);

  // Import key
  const cryptoKey = await importKey(keyBytes);

  try {
    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return new Blob([plaintext]);
  } catch (error) {
    throw new ImageEncryptionError(
      'Decryption failed - invalid key or corrupted data',
      'DECRYPTION_FAILED'
    );
  }
}

/**
 * Encrypt the AES key for multiple recipients using NIP-44
 * @param keyBytes - 32-byte AES key to distribute
 * @param recipientPubkeys - Array of recipient public keys (hex)
 * @param senderPrivkey - Sender's private key (hex)
 * @returns Array of per-recipient encrypted keys
 */
export async function encryptKeyForRecipients(
  keyBytes: Uint8Array,
  recipientPubkeys: string[],
  senderPrivkey: string
): Promise<RecipientKey[]> {
  if (!recipientPubkeys || recipientPubkeys.length === 0) {
    throw new ImageEncryptionError(
      'At least one recipient is required',
      'NO_RECIPIENTS'
    );
  }

  // Convert key bytes to hex for encryption
  const keyHex = bytesToHex(keyBytes);

  const recipientKeys: RecipientKey[] = [];
  const errors: Array<{ pubkey: string; error: string }> = [];

  for (const recipientPubkey of recipientPubkeys) {
    try {
      // Validate pubkey format
      if (!/^[0-9a-f]{64}$/i.test(recipientPubkey)) {
        throw new Error('Invalid pubkey format');
      }

      // Get conversation key using NIP-44 ECDH
      const conversationKey = nip44.v2.utils.getConversationKey(
        hexToBytes(senderPrivkey),
        recipientPubkey
      );

      // Encrypt the AES key for this recipient
      const encryptedKey = nip44.v2.encrypt(keyHex, conversationKey);

      recipientKeys.push({
        pubkey: recipientPubkey,
        encryptedKey,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push({ pubkey: recipientPubkey, error: errorMessage });
    }
  }

  // If all encryptions failed, throw error
  if (recipientKeys.length === 0 && errors.length > 0) {
    throw new ImageEncryptionError(
      `Failed to encrypt key for all recipients: ${JSON.stringify(errors)}`,
      'KEY_ENCRYPTION_FAILED'
    );
  }

  return recipientKeys;
}

/**
 * Decrypt the AES key from a sender using NIP-44
 * @param encryptedKey - NIP-44 encrypted key string
 * @param senderPubkey - Sender's public key (hex)
 * @param recipientPrivkey - Recipient's private key (hex)
 * @returns Decrypted 32-byte AES key
 */
export async function decryptImageKey(
  encryptedKey: string,
  senderPubkey: string,
  recipientPrivkey: string
): Promise<Uint8Array> {
  try {
    // Validate inputs
    if (!/^[0-9a-f]{64}$/i.test(senderPubkey)) {
      throw new ImageEncryptionError(
        'Invalid sender pubkey format',
        'INVALID_SENDER_PUBKEY'
      );
    }
    if (!/^[0-9a-f]{64}$/i.test(recipientPrivkey)) {
      throw new ImageEncryptionError(
        'Invalid recipient privkey format',
        'INVALID_RECIPIENT_PRIVKEY'
      );
    }

    // Get conversation key using NIP-44 ECDH
    const conversationKey = nip44.v2.utils.getConversationKey(
      hexToBytes(recipientPrivkey),
      senderPubkey
    );

    // Decrypt the key
    const keyHex = nip44.v2.decrypt(encryptedKey, conversationKey);

    // Convert hex back to bytes
    return hexToBytes(keyHex);
  } catch (error) {
    if (error instanceof ImageEncryptionError) {
      throw error;
    }
    throw new ImageEncryptionError(
      'Failed to decrypt image key',
      'KEY_DECRYPTION_FAILED'
    );
  }
}

/**
 * Full encryption pipeline: encrypt blob and distribute key to recipients
 * @param blob - Image blob to encrypt
 * @param recipientPubkeys - Array of recipient public keys
 * @param senderPrivkey - Sender's private key
 * @returns Complete encrypted package for Nostr event
 */
export async function encryptImageForRecipients(
  blob: Blob,
  recipientPubkeys: string[],
  senderPrivkey: string
): Promise<EncryptedImagePackage> {
  // Generate random AES key
  const keyBytes = await generateImageKey();

  // Encrypt the image blob
  const { encryptedBlob, iv, salt } = await encryptImageBlob(blob, keyBytes);

  // Encrypt key for each recipient
  const recipientKeys = await encryptKeyForRecipients(
    keyBytes,
    recipientPubkeys,
    senderPrivkey
  );

  return {
    encryptedBlob,
    iv,
    salt,
    recipientKeys,
  };
}

/**
 * Full decryption pipeline: decrypt key then decrypt blob
 * @param encryptedBlob - Encrypted image data
 * @param encryptedKey - NIP-44 encrypted AES key
 * @param senderPubkey - Sender's public key
 * @param recipientPrivkey - Recipient's private key
 * @returns Decrypted blob
 */
export async function decryptImageFromSender(
  encryptedBlob: ArrayBuffer,
  encryptedKey: string,
  senderPubkey: string,
  recipientPrivkey: string
): Promise<Blob> {
  // Decrypt the AES key
  const keyBytes = await decryptImageKey(
    encryptedKey,
    senderPubkey,
    recipientPrivkey
  );

  // Decrypt the image blob
  return decryptImageBlob(encryptedBlob, keyBytes);
}

// Utility functions for base64 conversion

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  return hexToBytes(hex);
}

export default {
  generateImageKey,
  encryptImageBlob,
  decryptImageBlob,
  encryptKeyForRecipients,
  decryptImageKey,
  encryptImageForRecipients,
  decryptImageFromSender,
  isImageEncryptionAvailable,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  ImageEncryptionError,
};
