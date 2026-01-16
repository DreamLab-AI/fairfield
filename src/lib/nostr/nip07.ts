/**
 * NIP-07 Browser Extension Support
 *
 * Provides utilities for detecting and using Nostr browser extensions
 * like nos2x, Alby, or other NIP-07 compatible signers.
 */

import { browser } from '$app/environment';

// Use the existing window.nostr type from NDK
type Nip07Nostr = typeof window.nostr;

/**
 * Check if a NIP-07 browser extension is available
 */
export function hasNip07Extension(): boolean {
  if (!browser) return false;
  return typeof window.nostr !== 'undefined';
}

/**
 * Wait for NIP-07 extension to be ready (some extensions inject after page load)
 * @param timeout - Maximum time to wait in ms (default 2000)
 */
export async function waitForNip07(timeout = 2000): Promise<boolean> {
  if (!browser) return false;

  if (hasNip07Extension()) return true;

  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      if (hasNip07Extension()) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

/**
 * Get public key from NIP-07 extension
 */
export async function getPublicKeyFromExtension(): Promise<string> {
  if (!browser || !window.nostr) {
    throw new Error('No NIP-07 extension available');
  }

  try {
    const pubkey = await window.nostr.getPublicKey();

    // Validate pubkey format (64 hex chars)
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      throw new Error('Invalid public key format from extension');
    }

    return pubkey;
  } catch (error) {
    if (error instanceof Error && error.message.includes('User rejected')) {
      throw new Error('Extension access denied by user');
    }
    throw error;
  }
}

/**
 * Sign an event using NIP-07 extension
 * @param event - Unsigned event object
 * @returns Signed event with id and sig
 */
export async function signEventWithExtension(event: {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
}): Promise<{ id: string; sig: string; kind: number; content: string; tags: string[][]; created_at: number; pubkey: string }> {
  if (!browser || !window.nostr) {
    throw new Error('No NIP-07 extension available');
  }

  try {
    // NDK's window.nostr types are compatible
    const signedEvent = await window.nostr.signEvent(event);
    return {
      ...event,
      id: (signedEvent as { id?: string }).id || '',
      sig: signedEvent.sig
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('User rejected')) {
      throw new Error('Signing rejected by user');
    }
    throw error;
  }
}

/**
 * NIP-04 encryption via extension - REMOVED
 *
 * NIP-04 was removed on 2025-12-01. Use NIP-44 encryption instead.
 * Check hasNip44Support() and use NIP-44 methods from your extension.
 */
export async function encryptWithExtension(_pubkey: string, _plaintext: string): Promise<never> {
  throw new Error(
    'NIP-04 encryption was removed on 2025-12-01. ' +
    'Use NIP-44 encryption (kind 1059 gift wrap) instead. ' +
    'Check hasNip44Support() for extension compatibility.'
  );
}

/**
 * NIP-04 decryption via extension - REMOVED
 *
 * NIP-04 was removed on 2025-12-01. Use NIP-44 decryption instead.
 */
export async function decryptWithExtension(_pubkey: string, _ciphertext: string): Promise<never> {
  throw new Error(
    'NIP-04 decryption was removed on 2025-12-01. ' +
    'Use NIP-44 decryption (kind 1059 gift wrap) instead. ' +
    'Check hasNip44Support() for extension compatibility.'
  );
}

/**
 * Check if extension supports NIP-44 (newer encryption)
 */
export function hasNip44Support(): boolean {
  if (!browser || !window.nostr) return false;
  return typeof window.nostr.nip44?.encrypt === 'function';
}

/**
 * Get relay list from extension (if available)
 */
export async function getRelaysFromExtension(): Promise<Record<string, { read: boolean; write: boolean }> | null> {
  if (!browser || !window.nostr?.getRelays) return null;

  try {
    return await window.nostr.getRelays();
  } catch {
    return null;
  }
}

/**
 * Get extension name if available (for UI display)
 */
export function getExtensionName(): string {
  if (!browser || !window.nostr) return 'Unknown';

  // Try to detect common extensions by checking their specific properties
  // This is heuristic - extensions don't always identify themselves
  const nostr = window.nostr as Nip07Nostr & {
    _name?: string;
    isAlby?: boolean;
    nos2x?: boolean;
  };

  if (nostr?._name) return nostr._name;
  if (nostr?.isAlby) return 'Alby';
  if (nostr?.nos2x) return 'nos2x';

  return 'Browser Extension';
}
