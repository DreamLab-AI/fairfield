/**
 * Unit Tests: DID:NOSTR Module
 *
 * Tests for the did:nostr implementation including:
 * - pubkeyToDID / didToPubkey conversions
 * - Multikey encoding/decoding
 * - DID Document generation
 * - DID resolution
 * - npub <-> did:nostr conversions
 * - Invalid input handling
 */

import { describe, it, expect } from 'vitest';
import {
  pubkeyToDID,
  didToPubkey,
  isValidNostrDID,
  encodeMultikey,
  decodeMultikey,
  generateDIDDocument,
  resolveDID,
  npubToDID,
  didToNpub,
  createAuthenticationDIDDocument,
  verifyDIDDocument,
  type DIDDocument
} from '$lib/nostr/did';
import { nip19 } from 'nostr-tools';

// Test vectors - well-known test pubkeys
const TEST_PUBKEYS = {
  // Valid 64-character hex pubkeys
  VALID_1: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  VALID_2: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  VALID_3: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  // All zeros - edge case
  ALL_ZEROS: '0000000000000000000000000000000000000000000000000000000000000000',
  // All ones (f's in hex)
  ALL_ONES: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
};

const INVALID_PUBKEYS = {
  TOO_SHORT: 'a1b2c3d4e5f6',
  TOO_LONG: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  NOT_HEX: 'g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  UPPERCASE_MIXED: 'A1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6A1B2',
  EMPTY: '',
  WITH_SPACES: ' a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b '
};

describe('DID:NOSTR Module', () => {
  describe('pubkeyToDID', () => {
    it('should convert valid hex pubkey to did:nostr format', () => {
      const did = pubkeyToDID(TEST_PUBKEYS.VALID_1);
      expect(did).toBe(`did:nostr:${TEST_PUBKEYS.VALID_1}`);
    });

    it('should normalize uppercase hex to lowercase', () => {
      const uppercasePubkey = TEST_PUBKEYS.VALID_1.toUpperCase();
      const did = pubkeyToDID(uppercasePubkey);
      expect(did).toBe(`did:nostr:${TEST_PUBKEYS.VALID_1.toLowerCase()}`);
    });

    it('should trim whitespace from pubkey', () => {
      const did = pubkeyToDID(`  ${TEST_PUBKEYS.VALID_1}  `);
      expect(did).toBe(`did:nostr:${TEST_PUBKEYS.VALID_1}`);
    });

    it('should handle all-zeros pubkey', () => {
      const did = pubkeyToDID(TEST_PUBKEYS.ALL_ZEROS);
      expect(did).toBe(`did:nostr:${TEST_PUBKEYS.ALL_ZEROS}`);
    });

    it('should handle all-ones pubkey', () => {
      const did = pubkeyToDID(TEST_PUBKEYS.ALL_ONES);
      expect(did).toBe(`did:nostr:${TEST_PUBKEYS.ALL_ONES}`);
    });

    it('should throw error for too short pubkey', () => {
      expect(() => pubkeyToDID(INVALID_PUBKEYS.TOO_SHORT))
        .toThrow('Invalid pubkey: must be 64 lowercase hex characters');
    });

    it('should throw error for too long pubkey', () => {
      expect(() => pubkeyToDID(INVALID_PUBKEYS.TOO_LONG))
        .toThrow('Invalid pubkey: must be 64 lowercase hex characters');
    });

    it('should throw error for non-hex characters', () => {
      expect(() => pubkeyToDID(INVALID_PUBKEYS.NOT_HEX))
        .toThrow('Invalid pubkey: must be 64 lowercase hex characters');
    });

    it('should throw error for empty string', () => {
      expect(() => pubkeyToDID(INVALID_PUBKEYS.EMPTY))
        .toThrow('Invalid pubkey: must be 64 lowercase hex characters');
    });
  });

  describe('didToPubkey', () => {
    it('should extract pubkey from valid did:nostr', () => {
      const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
      const pubkey = didToPubkey(did);
      expect(pubkey).toBe(TEST_PUBKEYS.VALID_1);
    });

    it('should normalize uppercase pubkey in DID to lowercase', () => {
      const did = `did:nostr:${TEST_PUBKEYS.VALID_1.toUpperCase()}`;
      const pubkey = didToPubkey(did);
      expect(pubkey).toBe(TEST_PUBKEYS.VALID_1.toLowerCase());
    });

    it('should throw error for invalid DID format - missing prefix', () => {
      expect(() => didToPubkey(TEST_PUBKEYS.VALID_1))
        .toThrow('Invalid did:nostr format');
    });

    it('should throw error for invalid DID format - wrong method', () => {
      expect(() => didToPubkey(`did:key:${TEST_PUBKEYS.VALID_1}`))
        .toThrow('Invalid did:nostr format');
    });

    it('should throw error for invalid DID format - short pubkey', () => {
      expect(() => didToPubkey('did:nostr:abc123'))
        .toThrow('Invalid did:nostr format');
    });

    it('should throw error for empty DID', () => {
      expect(() => didToPubkey(''))
        .toThrow('Invalid did:nostr format');
    });

    it('should throw error for did:nostr: with no pubkey', () => {
      expect(() => didToPubkey('did:nostr:'))
        .toThrow('Invalid did:nostr format');
    });
  });

  describe('isValidNostrDID', () => {
    it('should return true for valid did:nostr', () => {
      const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
      expect(isValidNostrDID(did)).toBe(true);
    });

    it('should return true for uppercase hex in DID (case-insensitive)', () => {
      const did = `did:nostr:${TEST_PUBKEYS.VALID_1.toUpperCase()}`;
      expect(isValidNostrDID(did)).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(isValidNostrDID('not-a-did')).toBe(false);
      expect(isValidNostrDID('did:key:abc')).toBe(false);
      expect(isValidNostrDID('')).toBe(false);
    });

    it('should return false for did:nostr with short pubkey', () => {
      expect(isValidNostrDID('did:nostr:abc123')).toBe(false);
    });
  });

  describe('Multikey Encoding/Decoding', () => {
    describe('encodeMultikey', () => {
      it('should encode pubkey to multibase format starting with z', () => {
        const multikey = encodeMultikey(TEST_PUBKEYS.VALID_1);
        expect(multikey).toMatch(/^z[1-9A-HJ-NP-Za-km-z]+$/);
      });

      it('should produce consistent encoding', () => {
        const multikey1 = encodeMultikey(TEST_PUBKEYS.VALID_1);
        const multikey2 = encodeMultikey(TEST_PUBKEYS.VALID_1);
        expect(multikey1).toBe(multikey2);
      });

      it('should produce different encodings for different pubkeys', () => {
        const multikey1 = encodeMultikey(TEST_PUBKEYS.VALID_1);
        const multikey2 = encodeMultikey(TEST_PUBKEYS.VALID_2);
        expect(multikey1).not.toBe(multikey2);
      });

      it('should handle all-zeros pubkey', () => {
        const multikey = encodeMultikey(TEST_PUBKEYS.ALL_ZEROS);
        expect(multikey).toMatch(/^z[1-9A-HJ-NP-Za-km-z]+$/);
      });
    });

    describe('decodeMultikey', () => {
      it('should decode multikey back to original pubkey', () => {
        const multikey = encodeMultikey(TEST_PUBKEYS.VALID_1);
        const decoded = decodeMultikey(multikey);
        expect(decoded).toBe(TEST_PUBKEYS.VALID_1);
      });

      it('should roundtrip encode/decode correctly', () => {
        for (const pubkey of Object.values(TEST_PUBKEYS)) {
          const encoded = encodeMultikey(pubkey);
          const decoded = decodeMultikey(encoded);
          expect(decoded).toBe(pubkey.toLowerCase());
        }
      });

      it('should throw error for invalid multibase prefix', () => {
        expect(() => decodeMultikey('abc123'))
          .toThrow('Invalid Multikey: must start with "z"');
      });

      it('should throw error for invalid multicodec prefix', () => {
        // Encode with wrong prefix manually
        expect(() => decodeMultikey('z11111'))
          .toThrow(/Invalid Multikey/);
      });
    });
  });

  describe('DID Document Generation', () => {
    describe('generateDIDDocument', () => {
      it('should generate valid DID Document structure', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);

        expect(doc['@context']).toBeDefined();
        expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
        expect(doc.id).toBe(`did:nostr:${TEST_PUBKEYS.VALID_1}`);
        expect(doc.verificationMethod).toHaveLength(1);
        expect(doc.authentication).toBeDefined();
      });

      it('should include Multikey verification method', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);

        const vm = doc.verificationMethod[0];
        expect(vm.type).toBe('Multikey');
        expect(vm.controller).toBe(doc.id);
        expect(vm.publicKeyMultibase).toMatch(/^z/);
      });

      it('should reference verification method in authentication', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);

        const keyId = doc.verificationMethod[0].id;
        expect(doc.authentication).toContain(keyId);
      });

      it('should include relay service endpoints when provided', () => {
        const relays = ['wss://relay1.example.com', 'wss://relay2.example.com'];
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1, { relays });

        expect(doc.service).toBeDefined();
        expect(doc.service).toHaveLength(1);
        expect(doc.service![0].type).toBe('NostrRelay');
        expect(doc.service![0].serviceEndpoint).toEqual(relays);
      });

      it('should not include service when no relays provided', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);
        expect(doc.service).toBeUndefined();
      });

      it('should include NIP-19 verification method when requested', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1, { includeNip19: true });

        expect(doc.verificationMethod).toHaveLength(2);
        const nip19VM = doc.verificationMethod.find(vm => vm.type === 'Nip19EncodedKey');
        expect(nip19VM).toBeDefined();
        expect(nip19VM!.publicKeyHex).toBe(TEST_PUBKEYS.VALID_1);
      });

      it('should include alsoKnownAs with npub when NIP-19 enabled', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1, { includeNip19: true }) as DIDDocument & { alsoKnownAs?: string[] };

        expect(doc.alsoKnownAs).toBeDefined();
        expect(doc.alsoKnownAs![0]).toMatch(/^nostr:npub1/);
      });
    });

    describe('createAuthenticationDIDDocument', () => {
      it('should create minimal DID Document for authentication', () => {
        const doc = createAuthenticationDIDDocument(TEST_PUBKEYS.VALID_1);

        expect(doc['@context']).toEqual(['https://www.w3.org/ns/did/v1']);
        expect(doc.verificationMethod).toHaveLength(1);
        expect(doc.authentication).toHaveLength(1);
        expect(doc.service).toBeUndefined();
      });

      it('should only include authentication reference', () => {
        const doc = createAuthenticationDIDDocument(TEST_PUBKEYS.VALID_1);

        expect(doc.assertionMethod).toBeUndefined();
        expect(doc.capabilityInvocation).toBeUndefined();
        expect(doc.capabilityDelegation).toBeUndefined();
      });
    });
  });

  describe('DID Resolution', () => {
    describe('resolveDID', () => {
      it('should resolve valid did:nostr to DID Document', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const result = resolveDID(did);

        expect(result.didDocument).not.toBeNull();
        expect(result.didDocument!.id).toBe(did);
        expect(result.didResolutionMetadata.error).toBeUndefined();
      });

      it('should include contentType in resolution metadata', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const result = resolveDID(did);

        expect(result.didResolutionMetadata.contentType).toBe('application/did+json');
      });

      it('should include created timestamp in document metadata', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const result = resolveDID(did);

        expect(result.didDocumentMetadata.created).toBeDefined();
        expect(new Date(result.didDocumentMetadata.created!).getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('should return error for invalid DID format', () => {
        const result = resolveDID('invalid-did');

        expect(result.didDocument).toBeNull();
        expect(result.didResolutionMetadata.error).toBe('invalidDid');
        expect(result.didResolutionMetadata.errorMessage).toBeDefined();
      });

      it('should return error for wrong DID method', () => {
        const result = resolveDID('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');

        expect(result.didDocument).toBeNull();
        expect(result.didResolutionMetadata.error).toBe('invalidDid');
      });

      it('should include relays in resolved document when provided', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const relays = ['wss://relay.example.com'];
        const result = resolveDID(did, { relays });

        expect(result.didDocument!.service).toBeDefined();
        expect(result.didDocument!.service![0].serviceEndpoint).toEqual(relays);
      });
    });
  });

  describe('NIP-19 Conversions', () => {
    describe('npubToDID', () => {
      it('should convert valid npub to did:nostr', () => {
        const npub = nip19.npubEncode(TEST_PUBKEYS.VALID_1);
        const did = npubToDID(npub);

        expect(did).toBe(`did:nostr:${TEST_PUBKEYS.VALID_1}`);
      });

      it('should throw error for invalid npub', () => {
        expect(() => npubToDID('npub1invalid'))
          .toThrow();
      });

      it('should throw error for nsec (wrong type)', () => {
        // nsec format
        expect(() => npubToDID('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'))
          .toThrow('Invalid npub format');
      });

      it('should throw error for empty string', () => {
        expect(() => npubToDID(''))
          .toThrow();
      });
    });

    describe('didToNpub', () => {
      it('should convert did:nostr to valid npub', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const npub = didToNpub(did);

        expect(npub).toMatch(/^npub1[a-z0-9]+$/);

        // Verify roundtrip
        const decoded = nip19.decode(npub);
        expect(decoded.type).toBe('npub');
        expect(decoded.data).toBe(TEST_PUBKEYS.VALID_1);
      });

      it('should throw error for invalid DID', () => {
        expect(() => didToNpub('did:key:abc'))
          .toThrow('Invalid did:nostr format');
      });

      it('should produce consistent npub for same DID', () => {
        const did = `did:nostr:${TEST_PUBKEYS.VALID_1}`;
        const npub1 = didToNpub(did);
        const npub2 = didToNpub(did);

        expect(npub1).toBe(npub2);
      });
    });

    describe('npub <-> did:nostr roundtrip', () => {
      it('should roundtrip npub -> DID -> npub correctly', () => {
        const originalNpub = nip19.npubEncode(TEST_PUBKEYS.VALID_2);
        const did = npubToDID(originalNpub);
        const roundtrippedNpub = didToNpub(did);

        expect(roundtrippedNpub).toBe(originalNpub);
      });

      it('should roundtrip DID -> npub -> DID correctly', () => {
        const originalDid = `did:nostr:${TEST_PUBKEYS.VALID_3}`;
        const npub = didToNpub(originalDid);
        const roundtrippedDid = npubToDID(npub);

        expect(roundtrippedDid).toBe(originalDid);
      });
    });
  });

  describe('DID Document Verification', () => {
    describe('verifyDIDDocument', () => {
      it('should verify valid DID Document matches pubkey', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);
        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);

        expect(isValid).toBe(true);
      });

      it('should reject DID Document with wrong pubkey', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);
        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_2);

        expect(isValid).toBe(false);
      });

      it('should reject DID Document with mismatched id', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1);
        // Tamper with the document
        doc.id = `did:nostr:${TEST_PUBKEYS.VALID_2}`;

        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);
        expect(isValid).toBe(false);
      });

      it('should verify document with NIP-19 verification method', () => {
        const doc = generateDIDDocument(TEST_PUBKEYS.VALID_1, { includeNip19: true });
        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);

        expect(isValid).toBe(true);
      });

      it('should verify document with hex public key', () => {
        const doc: DIDDocument = {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: `did:nostr:${TEST_PUBKEYS.VALID_1}`,
          verificationMethod: [
            {
              id: `did:nostr:${TEST_PUBKEYS.VALID_1}#key-0`,
              type: 'JsonWebKey2020',
              controller: `did:nostr:${TEST_PUBKEYS.VALID_1}`,
              publicKeyHex: TEST_PUBKEYS.VALID_1
            }
          ]
        };

        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);
        expect(isValid).toBe(true);
      });

      it('should reject document with empty verification methods', () => {
        const doc: DIDDocument = {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: `did:nostr:${TEST_PUBKEYS.VALID_1}`,
          verificationMethod: []
        };

        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);
        expect(isValid).toBe(false);
      });

      it('should handle malformed multikey gracefully', () => {
        const doc: DIDDocument = {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: `did:nostr:${TEST_PUBKEYS.VALID_1}`,
          verificationMethod: [
            {
              id: `did:nostr:${TEST_PUBKEYS.VALID_1}#key-0`,
              type: 'Multikey',
              controller: `did:nostr:${TEST_PUBKEYS.VALID_1}`,
              publicKeyMultibase: 'invalid-multikey'
            }
          ]
        };

        const isValid = verifyDIDDocument(doc, TEST_PUBKEYS.VALID_1);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle pubkey with leading zeros', () => {
      const pubkeyWithLeadingZeros = '0000000000000000000000000000000000000000000000000000000000000001';
      const did = pubkeyToDID(pubkeyWithLeadingZeros);
      const extracted = didToPubkey(did);

      expect(extracted).toBe(pubkeyWithLeadingZeros);
    });

    it('should handle concurrent DID generation', async () => {
      const promises = Object.values(TEST_PUBKEYS).map(pubkey =>
        Promise.resolve(pubkeyToDID(pubkey))
      );

      const results = await Promise.all(promises);

      results.forEach((did, index) => {
        expect(did).toMatch(/^did:nostr:[a-f0-9]{64}$/);
      });
    });

    it('should maintain determinism across multiple calls', () => {
      const iterations = 100;
      const results: string[] = [];

      for (let i = 0; i < iterations; i++) {
        results.push(pubkeyToDID(TEST_PUBKEYS.VALID_1));
      }

      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });
  });
});
