/**
 * Unit Tests: NostrHandlers Registration Flow
 *
 * Tests the registration bypass logic (lines 67-82 of handlers.ts)
 * that allows Kind 0 (profile) and Kind 9024 (registration request)
 * events from non-whitelisted users during signup flow.
 *
 * Key behaviors tested:
 * 1. Kind 0 events bypass whitelist check
 * 2. Kind 9024 events bypass whitelist check
 * 3. Other event kinds require whitelist
 * 4. Event validation still required for all events
 * 5. Signature verification still required for all events
 * 6. Rate limiting applies to all events
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import { NostrHandlers } from '../../src/handlers';
import { NostrDatabase, NostrEvent } from '../../src/db';
import { Whitelist } from '../../src/whitelist';
import { RateLimiter } from '../../src/rateLimit';
import { createTestEvent, generateTestKey, TEST_ADMIN, TestIdentity } from '../fixtures/test-keys';

// Mock WebSocket
class MockWebSocket {
  ip?: string;
  readyState: number = WebSocket.OPEN;
  sentMessages: any[] = [];

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  getLastMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getMessages(type: string): any[] {
    return this.sentMessages.filter(m => m[0] === type);
  }

  clearMessages(): void {
    this.sentMessages = [];
  }
}

// Mock NostrDatabase
function createMockDatabase(options?: {
  isWhitelisted?: boolean;
  saveEventSuccess?: boolean;
}): jest.Mocked<NostrDatabase> {
  return {
    init: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    saveEvent: jest.fn<() => Promise<boolean>>().mockResolvedValue(options?.saveEventSuccess ?? true),
    queryEvents: jest.fn<() => Promise<NostrEvent[]>>().mockResolvedValue([]),
    isWhitelisted: jest.fn<() => Promise<boolean>>().mockResolvedValue(options?.isWhitelisted ?? false),
    getWhitelistEntry: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    addToWhitelist: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    removeFromWhitelist: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    listWhitelist: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
    listWhitelistPaginated: jest.fn<() => Promise<any>>().mockResolvedValue({ users: [], total: 0, limit: 20, offset: 0 }),
    getStats: jest.fn<() => Promise<any>>().mockResolvedValue({ eventCount: 0, whitelistCount: 0, dbSizeBytes: 0 }),
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NostrDatabase>;
}

// Mock Whitelist
function createMockWhitelist(options?: {
  allowedPubkeys?: string[];
  devMode?: boolean;  // SECURITY: Must be explicitly set to true for dev mode
}): jest.Mocked<Whitelist> {
  const allowedSet = new Set(options?.allowedPubkeys || []);
  const devModeEnabled = options?.devMode ?? false;  // Secure default: deny all

  return {
    isAllowed: jest.fn<(pubkey: string) => boolean>((pubkey: string) => {
      // SECURITY: Empty whitelist = deny all UNLESS devMode explicitly enabled
      if (allowedSet.size === 0) {
        return devModeEnabled;  // Only allow all if devMode is true
      }
      return allowedSet.has(pubkey);
    }),
    add: jest.fn<(pubkey: string) => void>((pubkey: string) => {
      allowedSet.add(pubkey);
    }),
    remove: jest.fn<(pubkey: string) => void>((pubkey: string) => {
      allowedSet.delete(pubkey);
    }),
    list: jest.fn<() => string[]>(() => Array.from(allowedSet)),
  } as unknown as jest.Mocked<Whitelist>;
}

// Mock RateLimiter
function createMockRateLimiter(options?: {
  eventLimitExceeded?: boolean;
  pubkeyLimitExceeded?: boolean;
  connectionLimitExceeded?: boolean;
}): jest.Mocked<RateLimiter> {
  return {
    checkEventLimit: jest.fn<() => boolean>().mockReturnValue(!(options?.eventLimitExceeded ?? false)),
    checkPubkeyEventLimit: jest.fn<() => boolean>().mockReturnValue(!(options?.pubkeyLimitExceeded ?? false)),
    checkEventLimits: jest.fn<() => { allowed: boolean; reason?: string }>().mockReturnValue({
      allowed: !(options?.eventLimitExceeded ?? false) && !(options?.pubkeyLimitExceeded ?? false),
      reason: options?.eventLimitExceeded ? 'rate limit exceeded: too many events per second from this IP' :
              options?.pubkeyLimitExceeded ? 'rate limit exceeded: too many events per second from this pubkey' : undefined,
    }),
    trackConnection: jest.fn<() => boolean>().mockReturnValue(!(options?.connectionLimitExceeded ?? false)),
    releaseConnection: jest.fn<() => void>(),
    getConnectionCount: jest.fn<() => number>().mockReturnValue(0),
    getEventRate: jest.fn<() => number>().mockReturnValue(0),
    getPubkeyEventRate: jest.fn<() => number>().mockReturnValue(0),
    getStats: jest.fn<() => any>().mockReturnValue({ trackedIPs: 0, trackedPubkeys: 0, activeConnections: 0, config: {} }),
    destroy: jest.fn<() => void>(),
    resetIP: jest.fn<() => void>(),
    resetPubkey: jest.fn<() => void>(),
    resetAll: jest.fn<() => void>(),
  } as unknown as jest.Mocked<RateLimiter>;
}

describe('NostrHandlers Registration Flow', () => {
  let handlers: NostrHandlers;
  let mockDb: jest.Mocked<NostrDatabase>;
  let mockWhitelist: jest.Mocked<Whitelist>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockWs: MockWebSocket;
  let nonWhitelistedUser: TestIdentity;
  let whitelistedUser: TestIdentity;

  beforeEach(() => {
    // Generate fresh keys for non-whitelisted user
    nonWhitelistedUser = generateTestKey();
    whitelistedUser = TEST_ADMIN;

    // Create mocks with whitelist containing only admin
    mockDb = createMockDatabase({ isWhitelisted: false });
    mockWhitelist = createMockWhitelist({
      allowedPubkeys: [whitelistedUser.publicKey]
    });
    mockRateLimiter = createMockRateLimiter();
    mockWs = new MockWebSocket();
    mockWs.ip = '127.0.0.1';

    handlers = new NostrHandlers(mockDb, mockWhitelist, mockRateLimiter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Registration Event Bypass (Kind 0 - Profile)', () => {
    it('should allow Kind 0 events from non-whitelisted users', async () => {
      const profileEvent = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({
        name: 'New User',
        display_name: 'New User Display',
        about: 'I am registering'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profileEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][1]).toBe(profileEvent.id);
      expect(okMessages[0][2]).toBe(true); // Success
      expect(okMessages[0][3]).toBe(''); // No error message

      // Verify whitelist was NOT checked for Kind 0
      expect(mockWhitelist.isAllowed).not.toHaveBeenCalled();
      expect(mockDb.isWhitelisted).not.toHaveBeenCalled();
    });

    it('should save Kind 0 events from non-whitelisted users', async () => {
      const profileEvent = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({
        name: 'New User'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profileEvent]));

      expect(mockDb.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: profileEvent.id,
          kind: 0,
          pubkey: nonWhitelistedUser.publicKey
        }),
        expect.objectContaining({
          treatment: 'replaceable' // Kind 0 is replaceable per NIP-01
        })
      );
    });

    it('should allow Kind 0 events from whitelisted users too', async () => {
      const profileEvent = createTestEvent(whitelistedUser, 0, JSON.stringify({
        name: 'Admin Profile Update'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profileEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(true);
    });
  });

  describe('Registration Event Bypass (Kind 9024 - Registration Request)', () => {
    it('should allow Kind 9024 events from non-whitelisted users', async () => {
      const registrationEvent = createTestEvent(nonWhitelistedUser, 9024, JSON.stringify({
        request_type: 'registration',
        message: 'Please approve my registration',
        display_name: 'New Member'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', registrationEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][1]).toBe(registrationEvent.id);
      expect(okMessages[0][2]).toBe(true);
      expect(okMessages[0][3]).toBe('');

      // Verify whitelist was NOT checked for Kind 9024
      expect(mockWhitelist.isAllowed).not.toHaveBeenCalled();
      expect(mockDb.isWhitelisted).not.toHaveBeenCalled();
    });

    it('should save Kind 9024 events from non-whitelisted users', async () => {
      const registrationEvent = createTestEvent(nonWhitelistedUser, 9024, JSON.stringify({
        request_type: 'registration'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', registrationEvent]));

      expect(mockDb.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: registrationEvent.id,
          kind: 9024,
          pubkey: nonWhitelistedUser.publicKey
        }),
        expect.any(Object)
      );
    });

    it('should allow Kind 9024 events from whitelisted users', async () => {
      const registrationEvent = createTestEvent(whitelistedUser, 9024, JSON.stringify({
        request_type: 'admin_action'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', registrationEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(true);
    });
  });

  describe('Whitelist Enforcement for Non-Registration Events', () => {
    it('should block Kind 1 (text note) from non-whitelisted users', async () => {
      const textEvent = createTestEvent(nonWhitelistedUser, 1, 'Hello world');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', textEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][1]).toBe(textEvent.id);
      expect(okMessages[0][2]).toBe(false); // Rejected
      expect(okMessages[0][3]).toContain('blocked');
      expect(okMessages[0][3]).toContain('not whitelisted');

      // Verify whitelist was checked
      expect(mockWhitelist.isAllowed).toHaveBeenCalledWith(nonWhitelistedUser.publicKey);
      expect(mockDb.isWhitelisted).toHaveBeenCalledWith(nonWhitelistedUser.publicKey);

      // Verify event was NOT saved
      expect(mockDb.saveEvent).not.toHaveBeenCalled();
    });

    it('should allow Kind 1 (text note) from whitelisted users via env whitelist', async () => {
      // Ensure the whitelist returns true for this user
      mockWhitelist.isAllowed.mockReturnValue(true);

      const textEvent = createTestEvent(whitelistedUser, 1, 'Admin message');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', textEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(true);
      expect(mockDb.saveEvent).toHaveBeenCalled();
    });

    it('should allow Kind 1 from users whitelisted in database', async () => {
      // User not in env whitelist but is in database
      mockDb.isWhitelisted.mockResolvedValue(true);

      const textEvent = createTestEvent(nonWhitelistedUser, 1, 'I am in DB whitelist');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', textEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(true);
      expect(mockDb.saveEvent).toHaveBeenCalled();
    });

    it('should block Kind 3 (contacts) from non-whitelisted users', async () => {
      const contactsEvent = createTestEvent(nonWhitelistedUser, 3, '', [
        ['p', 'somepubkey1'],
        ['p', 'somepubkey2']
      ]);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', contactsEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });

    it('should block Kind 4 (encrypted DM) from non-whitelisted users', async () => {
      const dmEvent = createTestEvent(nonWhitelistedUser, 4, 'encrypted content', [
        ['p', whitelistedUser.publicKey]
      ]);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', dmEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });

    it('should block Kind 7 (reaction) from non-whitelisted users', async () => {
      const reactionEvent = createTestEvent(nonWhitelistedUser, 7, '+', [
        ['e', 'someeventid']
      ]);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', reactionEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });

    it('should block ephemeral events (Kind 20000-29999) from non-whitelisted users', async () => {
      const ephemeralEvent = createTestEvent(nonWhitelistedUser, 20000, 'ephemeral');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', ephemeralEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });
  });

  describe('Event Validation (Applies to All Events)', () => {
    it('should reject Kind 0 with missing required fields', async () => {
      const invalidEvent = {
        id: 'a'.repeat(64),
        pubkey: nonWhitelistedUser.publicKey,
        // missing: created_at, kind, tags, content, sig
      };

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', invalidEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('invalid');
      expect(okMessages[0][3]).toContain('validation failed');
    });

    it('should reject Kind 9024 with invalid id length', async () => {
      const event = createTestEvent(nonWhitelistedUser, 9024, 'test');
      event.id = 'tooshort';

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('validation failed');
    });

    it('should reject Kind 0 with invalid pubkey length', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, '{}');
      event.pubkey = 'invalidpubkey';

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('validation failed');
    });

    it('should reject Kind 0 with invalid signature length', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, '{}');
      event.sig = 'short';

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('validation failed');
    });

    it('should reject event with non-array tags', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, '{}');
      (event as any).tags = 'not an array';

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('validation failed');
    });

    it('should reject event with non-string content', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, '{}');
      (event as any).content = 12345;

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('validation failed');
    });
  });

  describe('Event ID Verification (Applies to All Events)', () => {
    it('should reject Kind 0 with incorrect event id', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'Test' }));
      // Tamper with the event ID
      event.id = 'f'.repeat(64);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('event id verification failed');
    });

    it('should reject Kind 9024 with incorrect event id', async () => {
      const event = createTestEvent(nonWhitelistedUser, 9024, 'registration');
      event.id = 'a'.repeat(64);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('event id verification failed');
    });
  });

  describe('Signature Verification (Applies to All Events)', () => {
    it('should reject Kind 0 with invalid signature', async () => {
      const event = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'Test' }));
      // Tamper with signature
      event.sig = '0'.repeat(128);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('signature verification failed');
    });

    it('should reject Kind 9024 with invalid signature', async () => {
      const event = createTestEvent(nonWhitelistedUser, 9024, 'registration');
      event.sig = '1'.repeat(128);

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('signature verification failed');
    });

    it('should reject event signed by different key', async () => {
      const differentUser = generateTestKey();
      const event = createTestEvent(differentUser, 0, '{}');
      // Use correct signature but wrong pubkey
      event.pubkey = nonWhitelistedUser.publicKey;

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      // Will fail either id or signature verification
      expect(okMessages[0][3]).toContain('verification failed');
    });
  });

  describe('Rate Limiting (Applies to All Events)', () => {
    it('should rate limit Kind 0 events', async () => {
      mockRateLimiter.checkEventLimit.mockReturnValue(false);

      const event = createTestEvent(nonWhitelistedUser, 0, '{}');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('rate limit exceeded');

      // Event should NOT be processed further
      expect(mockDb.saveEvent).not.toHaveBeenCalled();
    });

    it('should rate limit Kind 9024 events', async () => {
      mockRateLimiter.checkEventLimit.mockReturnValue(false);

      const event = createTestEvent(nonWhitelistedUser, 9024, 'registration');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('rate limit exceeded');

      expect(mockDb.saveEvent).not.toHaveBeenCalled();
    });

    it('should rate limit Kind 1 events', async () => {
      mockRateLimiter.checkEventLimit.mockReturnValue(false);

      const event = createTestEvent(whitelistedUser, 1, 'Test');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('rate limit exceeded');
    });

    it('should check rate limit before other validations', async () => {
      mockRateLimiter.checkEventLimit.mockReturnValue(false);

      // Even an invalid event should be rate limited first
      const invalidEvent = { id: 'invalid' };

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', invalidEvent]));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('rate limit exceeded');
    });
  });

  describe('Per-Pubkey Rate Limiting', () => {
    it('should rate limit events when pubkey exceeds limit', async () => {
      // Ensure whitelist allows this user
      mockWhitelist.isAllowed.mockReturnValue(true);
      mockRateLimiter.checkPubkeyEventLimit.mockReturnValue(false);

      const event = createTestEvent(whitelistedUser, 1, 'Test message');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('rate-limited');
      expect(okMessages[0][3]).toContain('pubkey');

      // Event should NOT be saved
      expect(mockDb.saveEvent).not.toHaveBeenCalled();
    });

    it('should check pubkey rate limit after signature verification', async () => {
      // Ensure whitelist allows this user
      mockWhitelist.isAllowed.mockReturnValue(true);

      // This ensures we don't let someone DoS another user's pubkey
      const callOrder: string[] = [];
      mockRateLimiter.checkEventLimit.mockImplementation(() => {
        callOrder.push('checkEventLimit');
        return true;
      });
      mockRateLimiter.checkPubkeyEventLimit.mockImplementation(() => {
        callOrder.push('checkPubkeyEventLimit');
        return true;
      });

      const event = createTestEvent(whitelistedUser, 1, 'Test');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      // IP rate limit checked first, pubkey limit checked after signature verification
      expect(callOrder).toContain('checkEventLimit');
      expect(callOrder).toContain('checkPubkeyEventLimit');
      expect(callOrder.indexOf('checkEventLimit')).toBeLessThan(callOrder.indexOf('checkPubkeyEventLimit'));
    });

    it('should allow events when pubkey is within rate limit', async () => {
      // Ensure whitelist allows this user
      mockWhitelist.isAllowed.mockReturnValue(true);
      mockRateLimiter.checkPubkeyEventLimit.mockReturnValue(true);

      const event = createTestEvent(whitelistedUser, 1, 'Test message');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(true);
      expect(mockDb.saveEvent).toHaveBeenCalled();
    });

    it('should rate limit Kind 0 (profile) events per pubkey', async () => {
      mockRateLimiter.checkPubkeyEventLimit.mockReturnValue(false);

      const event = createTestEvent(nonWhitelistedUser, 0, '{}');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('rate-limited');
    });

    it('should rate limit Kind 9024 (registration) events per pubkey', async () => {
      mockRateLimiter.checkPubkeyEventLimit.mockReturnValue(false);

      const event = createTestEvent(nonWhitelistedUser, 9024, 'registration');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('rate-limited');
    });

    it('should call checkPubkeyEventLimit with correct pubkey', async () => {
      // Ensure whitelist allows this user
      mockWhitelist.isAllowed.mockReturnValue(true);

      const event = createTestEvent(whitelistedUser, 1, 'Test');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      // The pubkey comes from finalizeEvent which derives it from the private key
      expect(mockRateLimiter.checkPubkeyEventLimit).toHaveBeenCalledWith(event.pubkey);
    });
  });

  describe('Database Save Failure Handling', () => {
    it('should return error when Kind 0 save fails', async () => {
      mockDb.saveEvent.mockResolvedValue(false);

      const event = createTestEvent(nonWhitelistedUser, 0, '{}');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('failed to save event');
    });

    it('should return error when Kind 9024 save fails', async () => {
      mockDb.saveEvent.mockResolvedValue(false);

      const event = createTestEvent(nonWhitelistedUser, 9024, 'registration');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('failed to save event');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty whitelist with dev mode enabled', async () => {
      // SECURITY: In dev mode (RELAY_DEV_MODE=true), empty whitelist allows all
      // Without devMode, empty whitelist = deny all (secure default)
      const devWhitelist = createMockWhitelist({ devMode: true });
      const devHandlers = new NostrHandlers(mockDb, devWhitelist, mockRateLimiter);

      const event = createTestEvent(nonWhitelistedUser, 1, 'Test in dev mode');

      await devHandlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(true);
    });

    it('should deny all with empty whitelist by default (secure default)', async () => {
      // SECURITY: Empty whitelist WITHOUT devMode = deny all (secure default)
      const secureWhitelist = createMockWhitelist();  // No devMode = secure
      const secureHandlers = new NostrHandlers(mockDb, secureWhitelist, mockRateLimiter);
      const secureMockWs = new MockWebSocket();
      secureMockWs.ip = '127.0.0.1';

      const event = createTestEvent(nonWhitelistedUser, 1, 'Test secure default');

      await secureHandlers.handleMessage(secureMockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = secureMockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);  // Should be DENIED
      expect(okMessages[0][3]).toContain('not whitelisted');
    });

    it('should handle malformed JSON gracefully', async () => {
      await handlers.handleMessage(mockWs as unknown as WebSocket, '{invalid json}');

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('Error');
    });

    it('should handle non-array message format', async () => {
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify({ type: 'EVENT' }));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('Invalid message format');
    });

    it('should handle empty message array', async () => {
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify([]));

      const notices = mockWs.getMessages('NOTICE');
      expect(notices.length).toBe(1);
      expect(notices[0][1]).toContain('Invalid message format');
    });

    it('should handle missing websocket IP', async () => {
      mockWs.ip = undefined;

      const event = createTestEvent(nonWhitelistedUser, 0, '{}');

      // Should still work with 'unknown' IP
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      expect(mockRateLimiter.checkEventLimit).toHaveBeenCalledWith('unknown');
    });
  });

  describe('Multiple Registration Events', () => {
    it('should allow multiple Kind 0 events from same non-whitelisted user', async () => {
      const profile1 = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'First' }));
      const profile2 = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'Updated' }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profile1]));
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profile2]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(2);
      expect(okMessages[0][2]).toBe(true);
      expect(okMessages[1][2]).toBe(true);
    });

    it('should allow Kind 0 followed by Kind 9024 from non-whitelisted user', async () => {
      const profileEvent = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'New User' }));
      const registrationEvent = createTestEvent(nonWhitelistedUser, 9024, JSON.stringify({
        request_type: 'registration'
      }));

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profileEvent]));
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', registrationEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(2);
      expect(okMessages[0][2]).toBe(true);
      expect(okMessages[1][2]).toBe(true);
    });

    it('should block Kind 1 after allowing Kind 0 from non-whitelisted user', async () => {
      const profileEvent = createTestEvent(nonWhitelistedUser, 0, JSON.stringify({ name: 'New User' }));
      const textEvent = createTestEvent(nonWhitelistedUser, 1, 'Trying to post');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', profileEvent]));
      mockWs.clearMessages();
      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', textEvent]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages.length).toBe(1);
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });
  });

  describe('Boundary Kind Values', () => {
    it('should enforce whitelist for Kind -1 (hypothetical)', async () => {
      // Testing edge case - kind values near 0
      const event = createTestEvent(nonWhitelistedUser, 1, 'Kind 1');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
    });

    it('should enforce whitelist for Kind 9023 (just before registration)', async () => {
      const event = createTestEvent(nonWhitelistedUser, 9023, 'Not registration');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });

    it('should enforce whitelist for Kind 9025 (just after registration)', async () => {
      const event = createTestEvent(nonWhitelistedUser, 9025, 'Not registration');

      await handlers.handleMessage(mockWs as unknown as WebSocket, JSON.stringify(['EVENT', event]));

      const okMessages = mockWs.getMessages('OK');
      expect(okMessages[0][2]).toBe(false);
      expect(okMessages[0][3]).toContain('not whitelisted');
    });
  });
});

describe('NostrHandlers Connection Management', () => {
  let handlers: NostrHandlers;
  let mockDb: jest.Mocked<NostrDatabase>;
  let mockWhitelist: jest.Mocked<Whitelist>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockWhitelist = createMockWhitelist();
    mockRateLimiter = createMockRateLimiter();
    mockWs = new MockWebSocket();

    handlers = new NostrHandlers(mockDb, mockWhitelist, mockRateLimiter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackConnection', () => {
    it('should track connection and return true when under limit', () => {
      const result = handlers.trackConnection(mockWs as unknown as WebSocket & { ip?: string }, '192.168.1.1');

      expect(result).toBe(true);
      expect(mockWs.ip).toBe('192.168.1.1');
      expect(mockRateLimiter.trackConnection).toHaveBeenCalledWith('192.168.1.1');
    });

    it('should reject connection when limit exceeded', () => {
      mockRateLimiter.trackConnection.mockReturnValue(false);

      const result = handlers.trackConnection(mockWs as unknown as WebSocket & { ip?: string }, '192.168.1.1');

      expect(result).toBe(false);
      const notices = mockWs.getMessages('NOTICE');
      expect(notices[0][1]).toContain('too many concurrent connections');
    });
  });

  describe('handleDisconnect', () => {
    it('should release connection on disconnect', () => {
      mockWs.ip = '192.168.1.1';

      handlers.handleDisconnect(mockWs as unknown as WebSocket & { ip?: string });

      expect(mockRateLimiter.releaseConnection).toHaveBeenCalledWith('192.168.1.1');
    });

    it('should handle disconnect without IP gracefully', () => {
      mockWs.ip = undefined;

      // Should not throw
      handlers.handleDisconnect(mockWs as unknown as WebSocket & { ip?: string });

      expect(mockRateLimiter.releaseConnection).not.toHaveBeenCalled();
    });
  });

  describe('getRateLimitStats', () => {
    it('should return rate limiter stats', () => {
      const mockStats = {
        trackedIPs: 5,
        trackedPubkeys: 3,
        activeConnections: 10,
        config: {
          eventsPerSecond: 10,
          eventsPerSecondPerPubkey: 5,
          maxConcurrentConnections: 20,
          cleanupIntervalMs: 30000
        }
      };
      mockRateLimiter.getStats.mockReturnValue(mockStats);

      const stats = handlers.getRateLimitStats();

      expect(stats).toEqual(mockStats);
    });
  });
});
