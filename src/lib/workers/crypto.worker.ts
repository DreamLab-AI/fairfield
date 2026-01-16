/**
 * Web Worker for offloading crypto operations from main thread
 *
 * Handles NIP-44 encryption/decryption operations to prevent blocking
 * the UI during intensive crypto work.
 *
 * NOTE: NIP-04 support was REMOVED on 2025-12-01.
 * All encrypted communications must use NIP-44.
 */

import { nip44 } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils.js';

export interface CryptoWorkerRequest {
  type: 'encrypt44' | 'decrypt44' | 'getConversationKey';
  id: string;
  payload: {
    privkey?: string;
    pubkey?: string;
    content?: string;
    ciphertext?: string;
    conversationKey?: Uint8Array;
  };
}

export interface CryptoWorkerResponse {
  id: string;
  success: boolean;
  result?: string | Uint8Array;
  error?: string;
}

self.onmessage = async (e: MessageEvent<CryptoWorkerRequest>) => {
  const { type, id, payload } = e.data;

  try {
    let result: string | Uint8Array;

    switch (type) {
      case 'encrypt44': {
        // NIP-44 encryption
        if (!payload.conversationKey || !payload.content) {
          throw new Error('Missing required parameters for encrypt44');
        }
        result = nip44.v2.encrypt(payload.content, payload.conversationKey);
        break;
      }

      case 'decrypt44': {
        // NIP-44 decryption
        if (!payload.conversationKey || !payload.ciphertext) {
          throw new Error('Missing required parameters for decrypt44');
        }
        result = nip44.v2.decrypt(payload.ciphertext, payload.conversationKey);
        break;
      }

      case 'getConversationKey': {
        // Get NIP-44 conversation key
        if (!payload.privkey || !payload.pubkey) {
          throw new Error('Missing required parameters for getConversationKey');
        }
        const privkeyBytes = hexToBytes(payload.privkey);
        result = nip44.v2.utils.getConversationKey(privkeyBytes, payload.pubkey);
        break;
      }

      default:
        throw new Error(
          `Unknown operation type: ${type}. ` +
          'Note: NIP-04 (encrypt/decrypt) was removed on 2025-12-01. Use NIP-44.'
        );
    }

    const response: CryptoWorkerResponse = { id, success: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: CryptoWorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    self.postMessage(response);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
