/**
 * Integration Tests for Security Fixes
 *
 * Tests complete security remediation implementations:
 * - SEC-002: Schnorr signature verification
 * - SEC-003: SQL injection prevention
 * - SEC-004: Rate limiting
 *
 * These tests validate the full integration of security fixes
 * in the Nostr relay server.
 */

import { Database } from '../db';
import { Whitelist } from '../whitelist';
import { RateLimiter } from '../rateLimit';
import { NostrHandlers } from '../handlers';
import { WebSocket } from 'ws';
import { schnorr } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

describe('Security Integration Tests', () => {
  let db: Database;
  let whitelist: Whitelist;
  let rateLimiter: RateLimiter;
  let handlers: NostrHandlers;
  let mockWebSocket: any;

  beforeEach(async () => {
    // Initialize components
    db = new Database();
    await db.init();

    whitelist = new Whitelist();
    rateLimiter = new RateLimiter();
    handlers = new NostrHandlers(db, whitelist, rateLimiter);

    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      ip: '127.0.0.1'
    } as unknown as WebSocket;
  });

  afterEach(async () => {
    await db.close();
  });

  describe('SEC-002: Schnorr Signature Verification Integration', () => {
    it('should accept event with valid signature', async () => {
      // Generate valid keypair
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      // Add to whitelist
      whitelist.add(pubkeyHex);

      // Create valid Nostr event
      const event = {
        pubkey: pubkeyHex,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test event with valid signature'
      };

      // Calculate event ID (NIP-01)
      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
      const eventId = sha256(new TextEncoder().encode(serialized));
      const eventIdHex = bytesToHex(eventId);

      // Sign event
      const signature = await schnorr.sign(eventId, privateKey);
      const signatureHex = bytesToHex(signature);

      const completeEvent = {
        id: eventIdHex,
        sig: signatureHex,
        ...event
      };

      // Send event
      const message = JSON.stringify(['EVENT', completeEvent]);
      await handlers.handleMessage(mockWebSocket, message);

      // Should send OK response
      expect(mockWebSocket.send).toHaveBeenCalled();
      const response = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(response[0]).toBe('OK');
      expect(response[1]).toBe(eventIdHex);
      expect(response[2]).toBe(true);
    });

    it('should reject event with invalid signature', async () => {
      const privateKey1 = schnorr.utils.randomPrivateKey();
      const privateKey2 = schnorr.utils.randomPrivateKey();
      const publicKey1 = schnorr.getPublicKey(privateKey1);
      const pubkeyHex = bytesToHex(publicKey1);

      whitelist.add(pubkeyHex);

      const event = {
        pubkey: pubkeyHex,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test event'
      };

      const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
      ]);
      const eventId = sha256(new TextEncoder().encode(serialized));
      const eventIdHex = bytesToHex(eventId);

      // Sign with different key
      const wrongSignature = await schnorr.sign(eventId, privateKey2);
      const wrongSigHex = bytesToHex(wrongSignature);

      const completeEvent = {
        id: eventIdHex,
        sig: wrongSigHex,
        ...event
      };

      const message = JSON.stringify(['EVENT', completeEvent]);
      await handlers.handleMessage(mockWebSocket, message);

      // Should reject with signature error
      expect(mockWebSocket.send).toHaveBeenCalled();
      const response = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(response[0]).toBe('OK');
      expect(response[2]).toBe(false);
      expect(response[3]).toContain('signature');
    });

    it('should reject event with tampered content', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      whitelist.add(pubkeyHex);

      const originalEvent = {
        pubkey: pubkeyHex,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Original content'
      };

      const serialized = JSON.stringify([
        0,
        originalEvent.pubkey,
        originalEvent.created_at,
        originalEvent.kind,
        originalEvent.tags,
        originalEvent.content
      ]);
      const eventId = sha256(new TextEncoder().encode(serialized));
      const eventIdHex = bytesToHex(eventId);
      const signature = await schnorr.sign(eventId, privateKey);
      const signatureHex = bytesToHex(signature);

      // Tamper with content after signing
      const tamperedEvent = {
        id: eventIdHex,
        sig: signatureHex,
        ...originalEvent,
        content: 'Tampered content' // Changed!
      };

      const message = JSON.stringify(['EVENT', tamperedEvent]);
      await handlers.handleMessage(mockWebSocket, message);

      // Should reject
      expect(mockWebSocket.send).toHaveBeenCalled();
      const response = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(response[2]).toBe(false);
    });
  });

  describe('SEC-003: SQL Injection Prevention Integration', () => {
    it('should safely handle tag queries with special characters', async () => {
      // Attempt SQL injection via tag filter
      const maliciousTag = "#e'; DROP TABLE events; --";

      // This should NOT execute SQL injection
      const results = await db.queryEvents({
        kinds: [1],
        '#e': [maliciousTag]
      });

      // Query should complete without error
      expect(Array.isArray(results)).toBe(true);

      // Events table should still exist
      const eventCount = await db.getEventCount();
      expect(typeof eventCount).toBe('number');
    });

    it('should escape SQL LIKE wildcards in tag values', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      whitelist.add(pubkeyHex);

      // Create event with % in tag
      const event = {
        pubkey: pubkeyHex,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', '100%match']],
        content: 'Test'
      };

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

      const completeEvent = {
        id: bytesToHex(eventId),
        sig: bytesToHex(signature),
        ...event
      };

      // Store event
      await db.storeEvent(completeEvent);

      // Query for exact match (% should be escaped, not treated as wildcard)
      const results = await db.queryEvents({
        kinds: [1],
        '#e': ['100%match']
      });

      expect(results.length).toBe(1);
      expect(results[0].tags[0][1]).toBe('100%match');
    });

    it('should validate tag names match allowed pattern', async () => {
      const invalidTagNames = [
        'tag; DROP TABLE',
        'tag--comment',
        "tag'inject",
        'tag"quote',
        'tag\\escape'
      ];

      for (const tagName of invalidTagNames) {
        const filter: any = {
          kinds: [1]
        };
        filter[`#${tagName}`] = ['value'];

        // Should handle gracefully (either reject or sanitize)
        await expect(async () => {
          await db.queryEvents(filter);
        }).not.toThrow();
      }
    });

    it('should handle multiple tag filters safely', async () => {
      const filters = {
        kinds: [1],
        '#e': ["'; DELETE FROM events; --"],
        '#p': ['100%'],
        '#a': ['_wildcard']
      };

      // Should complete without SQL injection
      const results = await db.queryEvents(filters);
      expect(Array.isArray(results)).toBe(true);

      // Database should still be intact
      const count = await db.getEventCount();
      expect(typeof count).toBe('number');
    });
  });

  describe('SEC-004: Rate Limiting Integration', () => {
    it('should allow events within rate limit', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      whitelist.add(pubkeyHex);

      // Send 5 events (within 10/sec limit)
      for (let i = 0; i < 5; i++) {
        const event = {
          pubkey: pubkeyHex,
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          tags: [],
          content: `Event ${i}`
        };

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

        const completeEvent = {
          id: bytesToHex(eventId),
          sig: bytesToHex(signature),
          ...event
        };

        const message = JSON.stringify(['EVENT', completeEvent]);
        await handlers.handleMessage(mockWebSocket, message);
      }

      // All should succeed
      expect(mockWebSocket.send).toHaveBeenCalledTimes(5);
      const responses = mockWebSocket.send.mock.calls.map((call: any) =>
        JSON.parse(call[0])
      );
      expect(responses.every((r: any) => r[2] === true)).toBe(true);
    });

    it('should reject events exceeding rate limit', async () => {
      const ip = '192.168.1.100';
      mockWebSocket.ip = ip;

      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      whitelist.add(pubkeyHex);

      // Attempt to send 15 events rapidly (exceeds 10/sec limit)
      const promises = [];
      for (let i = 0; i < 15; i++) {
        const event = {
          pubkey: pubkeyHex,
          created_at: Math.floor(Date.now() / 1000) + i,
          kind: 1,
          tags: [],
          content: `Spam ${i}`
        };

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

        const completeEvent = {
          id: bytesToHex(eventId),
          sig: bytesToHex(signature),
          ...event
        };

        const message = JSON.stringify(['EVENT', completeEvent]);
        promises.push(handlers.handleMessage(mockWebSocket, message));
      }

      await Promise.all(promises);

      // Some should be rejected with rate limit notice
      const calls = mockWebSocket.send.mock.calls;
      const notices = calls.filter((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg[0] === 'NOTICE' && msg[1].includes('rate limit');
        } catch {
          return false;
        }
      });

      expect(notices.length).toBeGreaterThan(0);
    });

    it('should track rate limits per IP address', async () => {
      const ip1 = '10.0.0.1';
      const ip2 = '10.0.0.2';

      const ws1 = { ...mockWebSocket, ip: ip1 };
      const ws2 = { ...mockWebSocket, ip: ip2 };

      // Track connections
      handlers.trackConnection(ws1, ip1);
      handlers.trackConnection(ws2, ip2);

      // Each IP should have independent rate limit
      expect(rateLimiter.checkEventLimit(ip1)).toBe(true);
      expect(rateLimiter.checkEventLimit(ip2)).toBe(true);

      // Exhaust ip1's limit
      for (let i = 0; i < 15; i++) {
        rateLimiter.checkEventLimit(ip1);
      }

      // ip1 should be limited, ip2 should still be allowed
      expect(rateLimiter.checkEventLimit(ip1)).toBe(false);
      expect(rateLimiter.checkEventLimit(ip2)).toBe(true);
    });

    it('should enforce connection limit per IP', async () => {
      const ip = '192.168.1.1';
      const connections = [];

      // Create 20 connections (at limit)
      for (let i = 0; i < 20; i++) {
        const ws = { ...mockWebSocket, ip };
        const allowed = handlers.trackConnection(ws, ip);
        expect(allowed).toBe(true);
        connections.push(ws);
      }

      // 21st connection should be rejected
      const ws21 = { ...mockWebSocket, ip };
      const allowed = handlers.trackConnection(ws21, ip);
      expect(allowed).toBe(false);

      // Disconnect one
      handlers.handleDisconnect(connections[0]);

      // Now 21st connection should succeed
      const allowed2 = handlers.trackConnection(ws21, ip);
      expect(allowed2).toBe(true);
    });
  });

  describe('Combined Security Integration', () => {
    it('should enforce all security measures together', async () => {
      const privateKey = schnorr.utils.randomPrivateKey();
      const publicKey = schnorr.getPublicKey(privateKey);
      const pubkeyHex = bytesToHex(publicKey);

      // 1. Whitelist check
      whitelist.add(pubkeyHex);

      // 2. Rate limit check
      const ip = '10.1.1.1';
      mockWebSocket.ip = ip;
      handlers.trackConnection(mockWebSocket, ip);

      // 3. Create event with SQL injection attempt in tags
      const event = {
        pubkey: pubkeyHex,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', "'; DROP TABLE events; --"]],
        content: 'Test combined security'
      };

      // 4. Sign correctly (signature verification)
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

      const completeEvent = {
        id: bytesToHex(eventId),
        sig: bytesToHex(signature),
        ...event
      };

      const message = JSON.stringify(['EVENT', completeEvent]);
      await handlers.handleMessage(mockWebSocket, message);

      // Should pass all checks and be stored safely
      expect(mockWebSocket.send).toHaveBeenCalled();
      const response = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(response[0]).toBe('OK');
      expect(response[2]).toBe(true);

      // Query should work (SQL injection prevented)
      const results = await db.queryEvents({
        kinds: [1],
        '#e': ["'; DROP TABLE events; --"]
      });
      expect(results.length).toBe(1);

      // Database should be intact
      const count = await db.getEventCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
