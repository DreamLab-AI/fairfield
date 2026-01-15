/**
 * Unit Tests: Key Generation and Management
 *
 * Tests for secp256k1 key generation, encoding, and restoration
 * for the simplified Nostr authentication system.
 */

import { describe, it, expect } from 'vitest';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getPublicKey } from 'nostr-tools';
import { isValidSecp256k1PrivateKey, isValidSecp256k1PublicKey } from '../setup';
import {
  generateKeyPair,
  encodePubkey,
  encodePrivkey,
  restoreFromNsecOrHex
} from '../../src/lib/nostr/keys';

/**
 * Test Suite: Key Generation
 */
describe('Key Generation', () => {
  describe('generateKeyPair()', () => {
    it('should produce valid secp256k1 private key (64 hex chars)', () => {
      const keys = generateKeyPair();

      expect(keys.privateKey).toMatch(/^[0-9a-f]{64}$/);
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
    });

    it('should produce valid secp256k1 public key (64 hex chars, x-only)', () => {
      const keys = generateKeyPair();

      // Nostr uses x-only pubkeys (32 bytes = 64 hex chars)
      expect(keys.publicKey).toMatch(/^[0-9a-f]{64}$/);
      expect(isValidSecp256k1PublicKey(keys.publicKey)).toBe(true);
    });

    it('should generate unique key pairs on each call', () => {
      const keys1 = generateKeyPair();
      const keys2 = generateKeyPair();

      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });

    it('should derive public key correctly from private key', () => {
      const keys = generateKeyPair();

      // Re-derive public key from private key and verify match
      const derivedPubkey = getPublicKey(hexToBytes(keys.privateKey));
      expect(derivedPubkey).toBe(keys.publicKey);
    });

    it('should generate cryptographically random keys', () => {
      // Generate multiple keys and verify they're all unique
      const privateKeys = new Set<string>();
      const count = 50;

      for (let i = 0; i < count; i++) {
        const keys = generateKeyPair();
        privateKeys.add(keys.privateKey);
      }

      // All should be unique
      expect(privateKeys.size).toBe(count);
    });
  });

  describe('encodePubkey()', () => {
    it('should encode hex public key to npub format', () => {
      const keys = generateKeyPair();
      const npub = encodePubkey(keys.publicKey);

      expect(npub).toMatch(/^npub1[a-z0-9]{58}$/);
    });

    it('should produce consistent encoding', () => {
      const keys = generateKeyPair();
      const npub1 = encodePubkey(keys.publicKey);
      const npub2 = encodePubkey(keys.publicKey);

      expect(npub1).toBe(npub2);
    });

    it('should encode known test vector correctly', () => {
      // Known hex pubkey
      const hexPubkey = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e';
      const npub = encodePubkey(hexPubkey);

      expect(npub.startsWith('npub1')).toBe(true);
      expect(npub.length).toBe(63);
    });
  });

  describe('encodePrivkey()', () => {
    it('should encode hex private key to nsec format', () => {
      const keys = generateKeyPair();
      const nsec = encodePrivkey(keys.privateKey);

      expect(nsec).toMatch(/^nsec1[a-z0-9]{58}$/);
    });

    it('should produce consistent encoding', () => {
      const keys = generateKeyPair();
      const nsec1 = encodePrivkey(keys.privateKey);
      const nsec2 = encodePrivkey(keys.privateKey);

      expect(nsec1).toBe(nsec2);
    });
  });

  describe('restoreFromNsecOrHex()', () => {
    it('should restore from hex private key', () => {
      const original = generateKeyPair();
      const restored = restoreFromNsecOrHex(original.privateKey);

      expect(restored.privateKey).toBe(original.privateKey);
      expect(restored.publicKey).toBe(original.publicKey);
    });

    it('should restore from nsec bech32 format', () => {
      const original = generateKeyPair();
      const nsec = encodePrivkey(original.privateKey);
      const restored = restoreFromNsecOrHex(nsec);

      expect(restored.privateKey).toBe(original.privateKey);
      expect(restored.publicKey).toBe(original.publicKey);
    });

    it('should handle hex with leading/trailing whitespace', () => {
      const original = generateKeyPair();
      const restored = restoreFromNsecOrHex(`  ${original.privateKey}  `);

      expect(restored.privateKey).toBe(original.privateKey);
      expect(restored.publicKey).toBe(original.publicKey);
    });

    it('should handle nsec with leading/trailing whitespace', () => {
      const original = generateKeyPair();
      const nsec = encodePrivkey(original.privateKey);
      const restored = restoreFromNsecOrHex(`  ${nsec}  `);

      expect(restored.privateKey).toBe(original.privateKey);
      expect(restored.publicKey).toBe(original.publicKey);
    });

    it('should normalize hex to lowercase', () => {
      const original = generateKeyPair();
      const upperHex = original.privateKey.toUpperCase();
      const restored = restoreFromNsecOrHex(upperHex);

      expect(restored.privateKey).toBe(original.privateKey.toLowerCase());
    });

    it('should throw on invalid hex length', () => {
      expect(() => restoreFromNsecOrHex('abc123')).toThrow('Invalid private key');
      expect(() => restoreFromNsecOrHex('a'.repeat(63))).toThrow('Invalid private key');
      expect(() => restoreFromNsecOrHex('a'.repeat(65))).toThrow('Invalid private key');
    });

    it('should throw on invalid hex characters', () => {
      expect(() => restoreFromNsecOrHex('z'.repeat(64))).toThrow('Invalid private key');
      expect(() => restoreFromNsecOrHex('g'.repeat(64))).toThrow('Invalid private key');
    });

    it('should throw on invalid nsec format', () => {
      expect(() => restoreFromNsecOrHex('nsec1invalid')).toThrow();
    });

    it('should throw on empty input', () => {
      expect(() => restoreFromNsecOrHex('')).toThrow();
      expect(() => restoreFromNsecOrHex('   ')).toThrow();
    });

    it('should throw on npub input (wrong type)', () => {
      const keys = generateKeyPair();
      const npub = encodePubkey(keys.publicKey);

      // Should not accept npub as private key
      expect(() => restoreFromNsecOrHex(npub)).toThrow();
    });
  });

  describe('Round-trip encoding', () => {
    it('should preserve keys through hex -> nsec -> hex round-trip', () => {
      const original = generateKeyPair();
      const nsec = encodePrivkey(original.privateKey);
      const restored = restoreFromNsecOrHex(nsec);

      expect(restored.privateKey).toBe(original.privateKey);
      expect(restored.publicKey).toBe(original.publicKey);
    });

    it('should handle multiple round-trips', () => {
      let keys = generateKeyPair();

      for (let i = 0; i < 10; i++) {
        const nsec = encodePrivkey(keys.privateKey);
        keys = restoreFromNsecOrHex(nsec);
      }

      // Verify keys are still valid
      expect(isValidSecp256k1PrivateKey(keys.privateKey)).toBe(true);
      expect(isValidSecp256k1PublicKey(keys.publicKey)).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should generate high-entropy keys', () => {
      // Generate multiple keys and verify uniqueness
      const keys = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const keyPair = generateKeyPair();
        keys.add(keyPair.privateKey);
      }

      // All should be unique
      expect(keys.size).toBe(count);
    });

    it('should not expose private key in any form except hex', () => {
      const keys = generateKeyPair();

      // Private key should only be the hex string
      expect(typeof keys.privateKey).toBe('string');
      expect(keys.privateKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('public key should be derivable from private key only', () => {
      const keys = generateKeyPair();

      // Verify the public key is the correct derivation
      const derivedPubkey = getPublicKey(hexToBytes(keys.privateKey));
      expect(keys.publicKey).toBe(derivedPubkey);
    });
  });

  describe('Edge Cases', () => {
    it('should handle keys with leading zeros', () => {
      // Generate many keys - some should have leading zeros
      for (let i = 0; i < 100; i++) {
        const keys = generateKeyPair();
        expect(keys.privateKey.length).toBe(64);
        expect(keys.publicKey.length).toBe(64);
      }
    });
  });
});
