/**
 * Unit Tests: NIP-07 Browser Extension Support
 *
 * Tests for browser extension detection, key retrieval, event signing,
 * and NIP-44 encryption support detection.
 *
 * NOTE: As of 2025-12-01, NIP-04 encryption/decryption functions have been
 * REMOVED. The encryptWithExtension and decryptWithExtension functions now
 * always throw errors instructing users to use NIP-44 instead.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock $app/environment before importing
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

// Import after mocking
import {
  hasNip07Extension,
  waitForNip07,
  getPublicKeyFromExtension,
  signEventWithExtension,
  encryptWithExtension,
  decryptWithExtension,
  hasNip44Support,
  getRelaysFromExtension,
  getExtensionName
} from '$lib/nostr/nip07';

// Valid test pubkey (64 hex chars)
const VALID_PUBKEY = 'a'.repeat(64);
const VALID_PRIVKEY = 'b'.repeat(64);

describe('NIP-07 Browser Extension Support', () => {
  // Store original window.nostr to restore after tests
  let originalNostr: typeof window.nostr;

  beforeEach(() => {
    originalNostr = window.nostr;
    // Reset window.nostr before each test
    (window as unknown as { nostr: unknown }).nostr = undefined;
  });

  afterEach(() => {
    (window as unknown as { nostr: unknown }).nostr = originalNostr;
    vi.clearAllMocks();
  });

  describe('hasNip07Extension', () => {
    it('should return false when window.nostr is undefined', () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;
      expect(hasNip07Extension()).toBe(false);
    });

    it('should return true when window.nostr is defined', () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn()
      };
      expect(hasNip07Extension()).toBe(true);
    });

    it('should return true for minimal nostr object', () => {
      (window as unknown as { nostr: unknown }).nostr = {};
      expect(hasNip07Extension()).toBe(true);
    });
  });

  describe('waitForNip07', () => {
    it('should resolve true immediately if extension is present', async () => {
      (window as unknown as { nostr: unknown }).nostr = { getPublicKey: vi.fn() };

      const result = await waitForNip07(1000);
      expect(result).toBe(true);
    });

    it('should resolve true when extension appears during wait', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      // Simulate extension loading after 150ms
      setTimeout(() => {
        (window as unknown as { nostr: unknown }).nostr = { getPublicKey: vi.fn() };
      }, 150);

      const result = await waitForNip07(2000);
      expect(result).toBe(true);
    });

    it('should resolve false after timeout if extension never appears', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      const start = Date.now();
      const result = await waitForNip07(300);
      const elapsed = Date.now() - start;

      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(290);
      expect(elapsed).toBeLessThan(500);
    });

    it('should use default timeout of 2000ms', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      // Test with no timeout parameter - should use 2000ms default
      // Set extension to appear just before default timeout
      setTimeout(() => {
        (window as unknown as { nostr: unknown }).nostr = { getPublicKey: vi.fn() };
      }, 500);

      const result = await waitForNip07();
      expect(result).toBe(true);
    });

    it('should poll at 100ms intervals', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;
      let checkCount = 0;

      const originalNostrGetter = Object.getOwnPropertyDescriptor(window, 'nostr');
      Object.defineProperty(window, 'nostr', {
        get() {
          checkCount++;
          return checkCount >= 3 ? { getPublicKey: vi.fn() } : undefined;
        },
        configurable: true
      });

      await waitForNip07(1000);

      // Restore original
      if (originalNostrGetter) {
        Object.defineProperty(window, 'nostr', originalNostrGetter);
      } else {
        delete (window as unknown as { nostr?: unknown }).nostr;
      }

      // Should have checked multiple times
      expect(checkCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getPublicKeyFromExtension', () => {
    it('should throw when no extension is available', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('No NIP-07 extension available');
    });

    it('should return pubkey from extension', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockResolvedValue(VALID_PUBKEY)
      };

      const pubkey = await getPublicKeyFromExtension();
      expect(pubkey).toBe(VALID_PUBKEY);
    });

    it('should validate pubkey format (64 hex chars)', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockResolvedValue('invalid')
      };

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('Invalid public key format from extension');
    });

    it('should reject uppercase hex as valid', async () => {
      const uppercasePubkey = 'A'.repeat(64);
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockResolvedValue(uppercasePubkey)
      };

      const pubkey = await getPublicKeyFromExtension();
      expect(pubkey).toBe(uppercasePubkey);
    });

    it('should reject too short pubkey', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockResolvedValue('a'.repeat(63))
      };

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('Invalid public key format from extension');
    });

    it('should reject too long pubkey', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockResolvedValue('a'.repeat(65))
      };

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('Invalid public key format from extension');
    });

    it('should throw user-friendly error when user rejects', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockRejectedValue(new Error('User rejected the request'))
      };

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('Extension access denied by user');
    });

    it('should re-throw other errors', async () => {
      const customError = new Error('Network error');
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn().mockRejectedValue(customError)
      };

      await expect(getPublicKeyFromExtension())
        .rejects.toThrow('Network error');
    });
  });

  describe('signEventWithExtension', () => {
    const unsignedEvent = {
      kind: 1,
      content: 'Hello Nostr!',
      tags: [['p', VALID_PUBKEY]],
      created_at: 1234567890,
      pubkey: VALID_PUBKEY
    };

    it('should throw when no extension is available', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      await expect(signEventWithExtension(unsignedEvent))
        .rejects.toThrow('No NIP-07 extension available');
    });

    it('should return signed event with id and sig', async () => {
      const signedEvent = {
        ...unsignedEvent,
        id: 'c'.repeat(64),
        sig: 'd'.repeat(128)
      };

      (window as unknown as { nostr: unknown }).nostr = {
        signEvent: vi.fn().mockResolvedValue(signedEvent)
      };

      const result = await signEventWithExtension(unsignedEvent);

      expect(result.id).toBe('c'.repeat(64));
      expect(result.sig).toBe('d'.repeat(128));
      expect(result.kind).toBe(1);
      expect(result.content).toBe('Hello Nostr!');
      expect(result.pubkey).toBe(VALID_PUBKEY);
    });

    it('should preserve original event properties', async () => {
      const signedEvent = {
        ...unsignedEvent,
        id: 'c'.repeat(64),
        sig: 'd'.repeat(128)
      };

      (window as unknown as { nostr: unknown }).nostr = {
        signEvent: vi.fn().mockResolvedValue(signedEvent)
      };

      const result = await signEventWithExtension(unsignedEvent);

      expect(result.tags).toEqual(unsignedEvent.tags);
      expect(result.created_at).toBe(unsignedEvent.created_at);
    });

    it('should throw user-friendly error when user rejects signing', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        signEvent: vi.fn().mockRejectedValue(new Error('User rejected signing'))
      };

      await expect(signEventWithExtension(unsignedEvent))
        .rejects.toThrow('Signing rejected by user');
    });

    it('should re-throw other signing errors', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        signEvent: vi.fn().mockRejectedValue(new Error('Signing failed'))
      };

      await expect(signEventWithExtension(unsignedEvent))
        .rejects.toThrow('Signing failed');
    });

    it('should handle event without id in response', async () => {
      // Some extensions might not return id
      (window as unknown as { nostr: unknown }).nostr = {
        signEvent: vi.fn().mockResolvedValue({
          sig: 'd'.repeat(128)
        })
      };

      const result = await signEventWithExtension(unsignedEvent);

      expect(result.id).toBe('');
      expect(result.sig).toBe('d'.repeat(128));
    });
  });

  describe('encryptWithExtension - REMOVED (NIP-04)', () => {
    it('should always throw error indicating NIP-04 was removed', async () => {
      // NIP-04 was removed on 2025-12-01
      // The function now always throws, regardless of extension state
      (window as unknown as { nostr: unknown }).nostr = {
        nip04: {
          encrypt: vi.fn().mockResolvedValue('would_be_encrypted')
        }
      };

      await expect(encryptWithExtension(VALID_PUBKEY, 'secret'))
        .rejects.toThrow('NIP-04 encryption was removed on 2025-12-01');
    });

    it('should throw with instructions to use NIP-44', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      await expect(encryptWithExtension(VALID_PUBKEY, 'secret'))
        .rejects.toThrow('Use NIP-44 encryption (kind 1059 gift wrap) instead');
    });

    it('should throw with hasNip44Support hint', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn()
      };

      await expect(encryptWithExtension(VALID_PUBKEY, 'secret'))
        .rejects.toThrow('Check hasNip44Support() for extension compatibility');
    });
  });

  describe('decryptWithExtension - REMOVED (NIP-04)', () => {
    it('should always throw error indicating NIP-04 was removed', async () => {
      // NIP-04 was removed on 2025-12-01
      // The function now always throws, regardless of extension state
      (window as unknown as { nostr: unknown }).nostr = {
        nip04: {
          decrypt: vi.fn().mockResolvedValue('would_be_decrypted')
        }
      };

      await expect(decryptWithExtension(VALID_PUBKEY, 'ciphertext'))
        .rejects.toThrow('NIP-04 decryption was removed on 2025-12-01');
    });

    it('should throw with instructions to use NIP-44', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;

      await expect(decryptWithExtension(VALID_PUBKEY, 'ciphertext'))
        .rejects.toThrow('Use NIP-44 decryption (kind 1059 gift wrap) instead');
    });

    it('should throw with hasNip44Support hint', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn()
      };

      await expect(decryptWithExtension(VALID_PUBKEY, 'ciphertext'))
        .rejects.toThrow('Check hasNip44Support() for extension compatibility');
    });
  });

  describe('hasNip44Support', () => {
    it('should return false when no extension', () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;
      expect(hasNip44Support()).toBe(false);
    });

    it('should return false when nip44 is not available', () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn()
      };
      expect(hasNip44Support()).toBe(false);
    });

    it('should return false when nip44.encrypt is not a function', () => {
      (window as unknown as { nostr: unknown }).nostr = {
        nip44: {
          encrypt: 'not a function'
        }
      };
      expect(hasNip44Support()).toBe(false);
    });

    it('should return true when nip44.encrypt is a function', () => {
      (window as unknown as { nostr: unknown }).nostr = {
        nip44: {
          encrypt: vi.fn()
        }
      };
      expect(hasNip44Support()).toBe(true);
    });
  });

  describe('getRelaysFromExtension', () => {
    it('should return null when no extension', async () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;
      const result = await getRelaysFromExtension();
      expect(result).toBeNull();
    });

    it('should return null when getRelays is not available', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getPublicKey: vi.fn()
      };
      const result = await getRelaysFromExtension();
      expect(result).toBeNull();
    });

    it('should return relays from extension', async () => {
      const relays = {
        'wss://relay.example.com': { read: true, write: true },
        'wss://relay2.example.com': { read: true, write: false }
      };

      (window as unknown as { nostr: unknown }).nostr = {
        getRelays: vi.fn().mockResolvedValue(relays)
      };

      const result = await getRelaysFromExtension();

      expect(result).toEqual(relays);
    });

    it('should return null on error', async () => {
      (window as unknown as { nostr: unknown }).nostr = {
        getRelays: vi.fn().mockRejectedValue(new Error('Failed'))
      };

      const result = await getRelaysFromExtension();
      expect(result).toBeNull();
    });
  });

  describe('getExtensionName', () => {
    it('should return "Unknown" when no extension', () => {
      (window as unknown as { nostr: unknown }).nostr = undefined;
      expect(getExtensionName()).toBe('Unknown');
    });

    it('should return _name if available', () => {
      (window as unknown as { nostr: { _name: string } }).nostr = {
        _name: 'MyExtension'
      };
      expect(getExtensionName()).toBe('MyExtension');
    });

    it('should detect Alby extension', () => {
      (window as unknown as { nostr: { isAlby: boolean } }).nostr = {
        isAlby: true
      };
      expect(getExtensionName()).toBe('Alby');
    });

    it('should detect nos2x extension', () => {
      (window as unknown as { nostr: { nos2x: boolean } }).nostr = {
        nos2x: true
      };
      expect(getExtensionName()).toBe('nos2x');
    });

    it('should return "Browser Extension" as fallback', () => {
      (window as unknown as { nostr: object }).nostr = {
        getPublicKey: vi.fn()
      };
      expect(getExtensionName()).toBe('Browser Extension');
    });

    it('should prioritize _name over other detection methods', () => {
      (window as unknown as { nostr: { _name: string; isAlby: boolean } }).nostr = {
        _name: 'CustomName',
        isAlby: true
      };
      expect(getExtensionName()).toBe('CustomName');
    });
  });
});
