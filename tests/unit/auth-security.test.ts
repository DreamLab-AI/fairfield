/**
 * Unit Tests: Authentication Security
 *
 * Tests for security fixes in the authentication system:
 * - saveKeysToStorage is disabled (no-op)
 * - loadKeysFromStorage warns on legacy data
 * - Session encryption
 * - Key handling security
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveKeysToStorage, loadKeysFromStorage, restoreFromNsecOrHex, generateKeyPair } from '$lib/nostr/keys';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    _getStore: () => store
  };
})();

// Valid test keys - must be exactly 64 hex characters
const TEST_KEYS = {
  VALID_NSEC: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
  VALID_HEX: 'e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7c5e8f32b5a7',
  VALID_PUBKEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
};

describe('Authentication Security', () => {
  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  describe('saveKeysToStorage - Disabled', () => {
    it('should be a no-op function that does not store keys', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      saveKeysToStorage(TEST_KEYS.VALID_PUBKEY, TEST_KEYS.VALID_HEX);

      // Verify nothing was stored
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should log security warning when called', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      saveKeysToStorage(TEST_KEYS.VALID_PUBKEY, TEST_KEYS.VALID_HEX);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] saveKeysToStorage is DEPRECATED')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Use authStore.setKeys()')
      );
    });

    it('should not throw errors when called', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => saveKeysToStorage(TEST_KEYS.VALID_PUBKEY, TEST_KEYS.VALID_HEX)).not.toThrow();
    });

    it('should return undefined', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveKeysToStorage(TEST_KEYS.VALID_PUBKEY, TEST_KEYS.VALID_HEX);
      expect(result).toBeUndefined();
    });

    it('should not expose private key even with valid inputs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      saveKeysToStorage(TEST_KEYS.VALID_PUBKEY, TEST_KEYS.VALID_HEX);

      // Ensure no localStorage operations occurred
      const store = localStorageMock._getStore();
      expect(Object.keys(store)).toHaveLength(0);
    });
  });

  describe('loadKeysFromStorage - Legacy Warning', () => {
    it('should return null when no keys are stored', () => {
      const result = loadKeysFromStorage();
      expect(result).toBeNull();
    });

    it('should return null for encrypted storage format', () => {
      localStorageMock.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: TEST_KEYS.VALID_PUBKEY,
        encryptedPrivateKey: 'encrypted-data-here'
      }));

      const result = loadKeysFromStorage();
      expect(result).toBeNull();
    });

    it('should warn and return legacy plaintext keys for migration', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate legacy plaintext storage
      localStorageMock.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: TEST_KEYS.VALID_PUBKEY,
        privateKey: TEST_KEYS.VALID_HEX
      }));

      const result = loadKeysFromStorage();

      // Should warn about legacy storage
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] Legacy plaintext keys detected')
      );

      // Should return keys for migration purposes
      expect(result).not.toBeNull();
      expect(result!.publicKey).toBe(TEST_KEYS.VALID_PUBKEY);
      expect(result!.privateKey).toBe(TEST_KEYS.VALID_HEX);
    });

    it('should return null for malformed JSON', () => {
      localStorageMock.setItem('nostr_bbs_keys', 'not-valid-json');

      const result = loadKeysFromStorage();
      expect(result).toBeNull();
    });

    it('should return null for empty object', () => {
      localStorageMock.setItem('nostr_bbs_keys', '{}');

      const result = loadKeysFromStorage();
      expect(result).toBeNull();
    });

    it('should handle missing localStorage gracefully', () => {
      // Temporarily remove localStorage
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const result = loadKeysFromStorage();
      expect(result).toBeNull();

      // Restore localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true
      });
    });
  });

  describe('Key Restoration Security', () => {
    describe('restoreFromNsecOrHex', () => {
      it('should restore keys from valid nsec', () => {
        const result = restoreFromNsecOrHex(TEST_KEYS.VALID_NSEC);

        expect(result.privateKey).toBeDefined();
        expect(result.publicKey).toBeDefined();
        expect(result.privateKey).toMatch(/^[a-f0-9]{64}$/);
        expect(result.publicKey).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should restore keys from valid hex', () => {
        const result = restoreFromNsecOrHex(TEST_KEYS.VALID_HEX);

        expect(result.privateKey).toBe(TEST_KEYS.VALID_HEX.toLowerCase());
        expect(result.publicKey).toBeDefined();
        expect(result.publicKey).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should trim whitespace from input', () => {
        const result = restoreFromNsecOrHex(`  ${TEST_KEYS.VALID_HEX}  `);

        expect(result.privateKey).toBe(TEST_KEYS.VALID_HEX.toLowerCase());
      });

      it('should normalize uppercase hex to lowercase', () => {
        const uppercaseHex = TEST_KEYS.VALID_HEX.toUpperCase();
        const result = restoreFromNsecOrHex(uppercaseHex);

        expect(result.privateKey).toBe(TEST_KEYS.VALID_HEX.toLowerCase());
      });

      it('should throw error for invalid nsec format', () => {
        expect(() => restoreFromNsecOrHex('nsec1invalid'))
          .toThrow();
      });

      it('should throw error for too short hex', () => {
        expect(() => restoreFromNsecOrHex('abc123'))
          .toThrow('Invalid private key: must be 64 hex characters or nsec format');
      });

      it('should throw error for too long hex', () => {
        const longHex = 'a'.repeat(128);
        expect(() => restoreFromNsecOrHex(longHex))
          .toThrow('Invalid private key: must be 64 hex characters or nsec format');
      });

      it('should throw error for non-hex characters', () => {
        const invalidHex = 'g'.repeat(64);
        expect(() => restoreFromNsecOrHex(invalidHex))
          .toThrow('Invalid private key: must be 64 hex characters or nsec format');
      });

      it('should throw error for empty input', () => {
        expect(() => restoreFromNsecOrHex(''))
          .toThrow();
      });

      it('should derive correct public key from private key', () => {
        // Generate a keypair and verify restoration produces same result
        const generated = generateKeyPair();
        const restored = restoreFromNsecOrHex(generated.privateKey);

        expect(restored.publicKey).toBe(generated.publicKey);
      });
    });
  });

  describe('Key Generation Security', () => {
    describe('generateKeyPair', () => {
      it('should generate unique keypairs each call', () => {
        const keypair1 = generateKeyPair();
        const keypair2 = generateKeyPair();

        expect(keypair1.privateKey).not.toBe(keypair2.privateKey);
        expect(keypair1.publicKey).not.toBe(keypair2.publicKey);
      });

      it('should generate valid hex format keys', () => {
        const keypair = generateKeyPair();

        expect(keypair.privateKey).toMatch(/^[a-f0-9]{64}$/);
        expect(keypair.publicKey).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should generate keys with sufficient entropy', () => {
        // Generate multiple keypairs and ensure no collisions
        const keypairs = new Set<string>();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          const keypair = generateKeyPair();
          keypairs.add(keypair.privateKey);
        }

        expect(keypairs.size).toBe(iterations);
      });

      it('should generate consistent public key from private key', () => {
        const keypair = generateKeyPair();

        // Restore from private key should produce same public key
        const restored = restoreFromNsecOrHex(keypair.privateKey);
        expect(restored.publicKey).toBe(keypair.publicKey);
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should not leak private key in error messages', () => {
      try {
        restoreFromNsecOrHex('invalid-key');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain(TEST_KEYS.VALID_HEX);
        expect(errorMessage).not.toContain('nsec1');
      }
    });

    it('should handle concurrent key operations safely', async () => {
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(generateKeyPair())
      );

      const results = await Promise.all(promises);
      const privateKeys = new Set(results.map(r => r.privateKey));

      // All generated keys should be unique
      expect(privateKeys.size).toBe(10);
    });

    it('should not expose key material in stack traces', () => {
      let stackTrace = '';

      try {
        // Force an error scenario
        restoreFromNsecOrHex('x'.repeat(64)); // Invalid hex (contains x)
      } catch (error) {
        stackTrace = (error as Error).stack || '';
      }

      // Stack trace should not contain key material
      expect(stackTrace).not.toMatch(/[a-f0-9]{64}/);
    });
  });

  describe('Deprecation Warnings', () => {
    it('saveKeysToStorage should clearly indicate deprecation', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      saveKeysToStorage('pubkey', 'privkey');

      const errorCall = consoleErrorSpy.mock.calls[0][0];
      expect(errorCall).toContain('DEPRECATED');
      expect(errorCall).toContain('disabled');
    });

    it('loadKeysFromStorage should warn about legacy plaintext', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorageMock.setItem('nostr_bbs_keys', JSON.stringify({
        publicKey: 'pubkey',
        privateKey: 'privkey'
      }));

      loadKeysFromStorage();

      const warnCall = consoleWarnSpy.mock.calls[0][0];
      expect(warnCall).toContain('Legacy plaintext');
      expect(warnCall).toContain('re-authenticate');
    });
  });
});
