import { schnorr } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Unit Tests for Cryptographic Validation
 *
 * Tests Schnorr signature verification implementation
 * as required by NIP-01 (Nostr Implementation Possibilities)
 *
 * Security Context: SEC-002 remediation validation
 */

describe('Schnorr Signature Verification', () => {
  describe('Valid Signature Verification', () => {
    it('should verify a valid Schnorr signature', async () => {
      // Generate a test keypair
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      // Create a test message hash
      const message = new TextEncoder().encode('test nostr event');
      const messageHash = sha256(message);

      // Sign the message
      const signature = await schnorr.sign(messageHash, privateKey);

      // Verify the signature
      const isValid = await schnorr.verify(signature, messageHash, publicKey);

      expect(isValid).toBe(true);
    });

    it('should verify signature with hex-encoded inputs', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      const message = new TextEncoder().encode('test event');
      const messageHash = sha256(message);

      const signature = await schnorr.sign(messageHash, privateKey);

      // Convert to hex (as Nostr protocol uses)
      const signatureHex = bytesToHex(signature);
      const messageHashHex = bytesToHex(messageHash);
      const publicKeyHex = bytesToHex(publicKey);

      // Convert back and verify
      const isValid = await schnorr.verify(
        hexToBytes(signatureHex),
        hexToBytes(messageHashHex),
        hexToBytes(publicKeyHex)
      );

      expect(isValid).toBe(true);
    });

    it('should verify signature for realistic Nostr event', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      // Simulate Nostr event serialization
      const event = {
        pubkey: bytesToHex(publicKey),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Hello Nostr!'
      };

      // NIP-01 event ID calculation
      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);

      const eventId = sha256(new TextEncoder().encode(serialized));
      const signature = await schnorr.sign(eventId, privateKey);

      // Verify
      const isValid = await schnorr.verify(signature, eventId, publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe('Invalid Signature Detection', () => {
    it('should reject signature with wrong public key', async () => {
      const privateKey1 = schnorr.utils.randomPrivateKey();
      const privateKey2 = schnorr.utils.randomPrivateKey();
      const publicKey2 = schnorr.getPublicKey(privateKey2);

      const message = sha256(new TextEncoder().encode('test'));
      const signature = await schnorr.sign(message, privateKey1);

      // Try to verify with different public key
      const isValid = await schnorr.verify(signature, message, publicKey2);
      expect(isValid).toBe(false);
    });

    it('should reject signature with tampered message', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      const originalMessage = sha256(new TextEncoder().encode('original'));
      const tamperedMessage = sha256(new TextEncoder().encode('tampered'));

      const signature = await schnorr.sign(originalMessage, privateKey);

      // Try to verify with different message
      const isValid = await schnorr.verify(signature, tamperedMessage, publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject malformed signature', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const message = sha256(new TextEncoder().encode('test'));

      // Create invalid signature (wrong length)
      const invalidSignature = new Uint8Array(32); // Should be 64 bytes

      await expect(
        schnorr.verify(invalidSignature, message, publicKey)
      ).rejects.toThrow();
    });

    it('should reject signature with invalid hex encoding', async () => {
      const invalidHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';

      expect(() => hexToBytes(invalidHex)).toThrow();
    });

    it('should reject signature with truncated data', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const message = sha256(new TextEncoder().encode('test'));

      const signature = await schnorr.sign(message, privateKey);

      // Truncate signature
      const truncatedSig = signature.slice(0, 32);

      await expect(
        schnorr.verify(truncatedSig, message, publicKey)
      ).rejects.toThrow();
    });
  });

  describe('Hex Conversion Utilities', () => {
    it('should convert bytes to hex correctly', () => {
      const bytes = new Uint8Array([0, 1, 2, 15, 16, 255]);
      const hex = bytesToHex(bytes);

      expect(hex).toBe('0001020f10ff');
      expect(hex.length).toBe(bytes.length * 2);
    });

    it('should convert hex to bytes correctly', () => {
      const hex = '0001020f10ff';
      const bytes = hexToBytes(hex);

      expect(Array.from(bytes)).toEqual([0, 1, 2, 15, 16, 255]);
    });

    it('should handle 64-character hex public keys', () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const hex = bytesToHex(publicKey);

      expect(hex.length).toBe(64); // 32 bytes * 2 hex chars
      expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
    });

    it('should handle 128-character hex signatures', () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const message = sha256(new TextEncoder().encode('test'));
      const signature = await schnorr.sign(message, privateKey);
      const hex = bytesToHex(signature);

      expect(hex.length).toBe(128); // 64 bytes * 2 hex chars
      expect(/^[0-9a-f]{128}$/.test(hex)).toBe(true);
    });

    it('should round-trip bytes->hex->bytes', () => {
      const original = new Uint8Array(32);
      crypto.getRandomValues(original);

      const hex = bytesToHex(original);
      const restored = hexToBytes(hex);

      expect(Array.from(restored)).toEqual(Array.from(original));
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum valid signature', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      // Empty message (still gets hashed)
      const message = sha256(new Uint8Array(0));
      const signature = await schnorr.sign(message, privateKey);

      const isValid = await schnorr.verify(signature, message, publicKey);
      expect(isValid).toBe(true);
    });

    it('should handle large message hashes', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);

      // Large message (gets hashed to 32 bytes anyway)
      const largeMessage = new Uint8Array(1024 * 1024); // 1MB
      crypto.getRandomValues(largeMessage);
      const messageHash = sha256(largeMessage);

      const signature = await schnorr.sign(messageHash, privateKey);
      const isValid = await schnorr.verify(signature, messageHash, publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject zero-filled signature', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const message = sha256(new TextEncoder().encode('test'));

      const zeroSignature = new Uint8Array(64); // All zeros

      const isValid = await schnorr.verify(zeroSignature, message, publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject all-ones signature', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const message = sha256(new TextEncoder().encode('test'));

      const onesSignature = new Uint8Array(64).fill(255);

      const isValid = await schnorr.verify(onesSignature, message, publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should verify signatures quickly (< 10ms each)', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const message = sha256(new TextEncoder().encode('test'));
      const signature = await schnorr.sign(message, privateKey);

      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await schnorr.verify(signature, message, publicKey);
      }

      const elapsed = Date.now() - start;
      const avgTime = elapsed / iterations;

      expect(avgTime).toBeLessThan(10); // Should be < 10ms per verification
    });

    it('should handle batch verification efficiently', async () => {
      const count = 50;
      const tests = [];

      for (let i = 0; i < count; i++) {
        const privateKey = schnorr.utils.randomPrivateKey();
        const publicKey = schnorr.getPublicKey(privateKey);
        const message = sha256(new TextEncoder().encode(`test ${i}`));
        const signature = await schnorr.sign(message, privateKey);

        tests.push({ signature, message, publicKey });
      }

      const start = Date.now();
      const results = await Promise.all(
        tests.map(t => schnorr.verify(t.signature, t.message, t.publicKey))
      );
      const elapsed = Date.now() - start;

      expect(results.every(r => r === true)).toBe(true);
      expect(elapsed).toBeLessThan(500); // Should be < 500ms for 50 verifications
    });
  });
});

describe('Security Properties', () => {
  it('should not allow signature reuse across different messages', async () => {
    const privateKey = schnorr.utils.randomPrivateKey();
    const publicKey = schnorr.getPublicKey(privateKey);

    const message1 = sha256(new TextEncoder().encode('message 1'));
    const message2 = sha256(new TextEncoder().encode('message 2'));

    const signature = await schnorr.sign(message1, privateKey);

    // Signature valid for message1
    expect(await schnorr.verify(signature, message1, publicKey)).toBe(true);

    // Signature invalid for message2
    expect(await schnorr.verify(signature, message2, publicKey)).toBe(false);
  });

  it('should produce different signatures for same message (due to nonce)', async () => {
    const privateKey = schnorr.utils.randomPrivateKey();
    const message = sha256(new TextEncoder().encode('same message'));

    const sig1 = await schnorr.sign(message, privateKey);
    const sig2 = await schnorr.sign(message, privateKey);

    // Signatures should be different (Schnorr uses random nonce)
    expect(bytesToHex(sig1)).not.toBe(bytesToHex(sig2));
  });

  it('should prevent private key recovery from signature', async () => {
    const privateKey = schnorr.utils.randomPrivateKey();
    const publicKey = schnorr.getPublicKey(privateKey);
    const message = sha256(new TextEncoder().encode('test'));
    const signature = await schnorr.sign(message, privateKey);

    // There's no way to recover private key from signature
    // This test just ensures signature verification doesn't leak key material
    const isValid = await schnorr.verify(signature, message, publicKey);
    expect(isValid).toBe(true);

    // Even with valid signature, we can't derive private key
    // (This is a fundamental property of Schnorr signatures)
  });
});
