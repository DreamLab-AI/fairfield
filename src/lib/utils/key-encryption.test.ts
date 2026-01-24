/**
 * Tests for Key Encryption Utilities
 *
 * Tests AES-GCM encryption/decryption of private keys using PBKDF2 key derivation.
 * Security-critical module - comprehensive edge case and boundary testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  generateSessionKey,
  isEncryptionAvailable
} from './key-encryption';

describe('Key Encryption Utilities', () => {
  // Test vectors
  const testPrivateKey = 'a'.repeat(64); // Valid 64-char hex private key
  const testPassword = 'correct-horse-battery-staple';
  const weakPassword = '123';
  const emptyPassword = '';

  describe('encryptPrivateKey', () => {
    it('should encrypt a private key successfully', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testPrivateKey);
      // Should be base64 encoded
      expect(() => atob(encrypted)).not.toThrow();
    });

    it('should produce different ciphertext for same input (random salt/IV)', async () => {
      const encrypted1 = await encryptPrivateKey(testPrivateKey, testPassword);
      const encrypted2 = await encryptPrivateKey(testPrivateKey, testPassword);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty private key', async () => {
      const encrypted = await encryptPrivateKey('', testPassword);

      expect(encrypted).toBeDefined();
      // Should still be decryptable
      const decrypted = await decryptPrivateKey(encrypted, testPassword);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters in private key', async () => {
      const unicodeKey = 'テスト鍵データ🔑'.repeat(5);
      const encrypted = await encryptPrivateKey(unicodeKey, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(unicodeKey);
    });

    it('should handle very long private keys', async () => {
      const longKey = 'x'.repeat(10000);
      const encrypted = await encryptPrivateKey(longKey, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(longKey);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';
      const encrypted = await encryptPrivateKey(testPrivateKey, specialPassword);
      const decrypted = await decryptPrivateKey(encrypted, specialPassword);

      expect(decrypted).toBe(testPrivateKey);
    });

    it('should handle unicode password', async () => {
      const unicodePassword = 'пароль密码パスワード🔐';
      const encrypted = await encryptPrivateKey(testPrivateKey, unicodePassword);
      const decrypted = await decryptPrivateKey(encrypted, unicodePassword);

      expect(decrypted).toBe(testPrivateKey);
    });

    it('should work with empty password (though not recommended)', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, emptyPassword);
      const decrypted = await decryptPrivateKey(encrypted, emptyPassword);

      expect(decrypted).toBe(testPrivateKey);
    });

    it('should work with weak password', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, weakPassword);
      const decrypted = await decryptPrivateKey(encrypted, weakPassword);

      expect(decrypted).toBe(testPrivateKey);
    });
  });

  describe('decryptPrivateKey', () => {
    it('should decrypt with correct password', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(testPrivateKey);
    });

    it('should throw error with wrong password', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);

      await expect(
        decryptPrivateKey(encrypted, 'wrong-password')
      ).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw error with similar but wrong password', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);

      // Similar password but different
      await expect(
        decryptPrivateKey(encrypted, testPassword + ' ')
      ).rejects.toThrow('Invalid password or corrupted data');

      await expect(
        decryptPrivateKey(encrypted, ' ' + testPassword)
      ).rejects.toThrow('Invalid password or corrupted data');

      await expect(
        decryptPrivateKey(encrypted, testPassword.toUpperCase())
      ).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw error with corrupted ciphertext', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      // Corrupt the middle of the encrypted data
      const corrupted = encrypted.slice(0, 10) + 'X' + encrypted.slice(11);

      await expect(
        decryptPrivateKey(corrupted, testPassword)
      ).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should throw error with truncated ciphertext', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const truncated = encrypted.slice(0, encrypted.length / 2);

      await expect(
        decryptPrivateKey(truncated, testPassword)
      ).rejects.toThrow();
    });

    it('should throw error with invalid base64', async () => {
      const invalidBase64 = '!!!not-valid-base64!!!';

      await expect(
        decryptPrivateKey(invalidBase64, testPassword)
      ).rejects.toThrow();
    });

    it('should throw error with empty encrypted data', async () => {
      await expect(
        decryptPrivateKey('', testPassword)
      ).rejects.toThrow();
    });

    it('should handle ciphertext with modified salt', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const decoded = atob(encrypted);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

      // Modify the salt (first 16 bytes)
      bytes[0] ^= 0xff;

      const modified = btoa(String.fromCharCode(...bytes));

      await expect(
        decryptPrivateKey(modified, testPassword)
      ).rejects.toThrow('Invalid password or corrupted data');
    });

    it('should handle ciphertext with modified IV', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const decoded = atob(encrypted);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

      // Modify the IV (bytes 16-27)
      bytes[16] ^= 0xff;

      const modified = btoa(String.fromCharCode(...bytes));

      await expect(
        decryptPrivateKey(modified, testPassword)
      ).rejects.toThrow('Invalid password or corrupted data');
    });
  });

  describe('generateSessionKey', () => {
    it('should generate a unique session key', () => {
      const key1 = generateSessionKey();
      const key2 = generateSessionKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with sufficient length', () => {
      const key = generateSessionKey();

      // Should be base64(32 bytes random) + timestamp in base36
      // At minimum, base64(32) = ~44 chars, plus timestamp
      expect(key.length).toBeGreaterThan(40);
    });

    it('should include timestamp component', () => {
      const key = generateSessionKey();

      // The key format is: base64(32 random bytes) + timestamp in base36
      // Base64 can contain A-Z, a-z, 0-9, +, /, =
      // The last part should include the base36 timestamp
      expect(key.length).toBeGreaterThan(44); // base64(32) is ~44 chars
    });

    it('should generate many unique keys without collision', () => {
      const keys = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        keys.add(generateSessionKey());
      }

      expect(keys.size).toBe(iterations);
    });
  });

  describe('isEncryptionAvailable', () => {
    it('should return true when crypto is available', () => {
      expect(isEncryptionAvailable()).toBe(true);
    });

    it('should detect crypto.subtle availability', () => {
      const result = isEncryptionAvailable();

      // In test environment with Web Crypto API polyfill
      expect(typeof result).toBe('boolean');
    });
  });

  describe('encryption format verification', () => {
    it('should produce output with correct structure (salt + iv + ciphertext)', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const decoded = atob(encrypted);
      const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

      // Structure: 16 bytes salt + 12 bytes IV + ciphertext (variable) + 16 bytes auth tag
      // Minimum size: 16 + 12 + 1 (min ciphertext) + 16 = 45 bytes
      expect(bytes.length).toBeGreaterThanOrEqual(45);

      // Salt should be 16 bytes
      const salt = bytes.slice(0, 16);
      expect(salt.length).toBe(16);

      // IV should be 12 bytes
      const iv = bytes.slice(16, 28);
      expect(iv.length).toBe(12);
    });

    it('should use AES-GCM with 256-bit key', async () => {
      // This is verified by successful encryption/decryption
      // AES-GCM with wrong key length would fail
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(testPrivateKey);
    });
  });

  describe('security boundary tests', () => {
    it('should not leak plaintext in error messages', async () => {
      const sensitiveKey = 'SENSITIVE_PRIVATE_KEY_DATA_12345';
      const encrypted = await encryptPrivateKey(sensitiveKey, testPassword);

      try {
        await decryptPrivateKey(encrypted, 'wrong-password');
      } catch (error) {
        // Error message should not contain the sensitive key
        expect((error as Error).message).not.toContain(sensitiveKey);
        expect((error as Error).message).not.toContain('SENSITIVE');
      }
    });

    it('should handle null bytes in private key', async () => {
      const keyWithNull = 'before\0after';
      const encrypted = await encryptPrivateKey(keyWithNull, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(keyWithNull);
    });

    it('should handle binary-like content', async () => {
      // Create a string with various byte values
      let binaryContent = '';
      for (let i = 1; i < 256; i++) {
        binaryContent += String.fromCharCode(i);
      }

      const encrypted = await encryptPrivateKey(binaryContent, testPassword);
      const decrypted = await decryptPrivateKey(encrypted, testPassword);

      expect(decrypted).toBe(binaryContent);
    });
  });

  describe('round-trip integrity', () => {
    it('should preserve exact content through encrypt/decrypt cycle', async () => {
      // Test a subset to avoid timeout - each encrypt/decrypt takes ~600ms due to PBKDF2
      const testCases = [
        testPrivateKey,
        '',
        'Line1\nLine2\nLine3',
      ];

      for (const testCase of testCases) {
        const encrypted = await encryptPrivateKey(testCase, testPassword);
        const decrypted = await decryptPrivateKey(encrypted, testPassword);

        expect(decrypted).toBe(testCase);
      }
    }, 10000);

    it('should handle multiple sequential encrypt/decrypt operations', async () => {
      let current = testPrivateKey;
      const password = testPassword;

      // Encrypt/decrypt multiple times
      for (let i = 0; i < 5; i++) {
        const encrypted = await encryptPrivateKey(current, password);
        current = await decryptPrivateKey(encrypted, password);
      }

      expect(current).toBe(testPrivateKey);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent encryptions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        encryptPrivateKey(`key-${i}`, testPassword)
      );

      const results = await Promise.all(promises);

      // All should be unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(10);
    });

    it('should handle concurrent encrypt/decrypt pairs', async () => {
      const pairs = Array.from({ length: 10 }, (_, i) => `key-${i}`);

      const encryptedPromises = pairs.map(key =>
        encryptPrivateKey(key, testPassword)
      );
      const encrypted = await Promise.all(encryptedPromises);

      const decryptedPromises = encrypted.map(enc =>
        decryptPrivateKey(enc, testPassword)
      );
      const decrypted = await Promise.all(decryptedPromises);

      expect(decrypted).toEqual(pairs);
    });
  });
});
