/**
 * Rate Limiter Unit Tests
 * Tests sliding window rate limiting for both IP and pubkey
 */
import { RateLimiter } from '../../src/rateLimit';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create with high limits to avoid accidental rate limiting in tests
    rateLimiter = new RateLimiter({
      eventsPerSecond: 10,
      eventsPerSecondPerPubkey: 5,
      maxConcurrentConnections: 20,
      cleanupIntervalMs: 60000, // Longer interval to avoid interference
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('IP-based Rate Limiting', () => {
    it('should allow events within rate limit', () => {
      const ip = '192.168.1.1';

      // Should allow up to the limit
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.checkEventLimit(ip)).toBe(true);
      }
    });

    it('should block events exceeding rate limit', () => {
      const ip = '192.168.1.1';

      // Use up the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip);
      }

      // 11th event should be blocked
      expect(rateLimiter.checkEventLimit(ip)).toBe(false);
    });

    it('should track different IPs independently', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // Use up limit for ip1
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip1);
      }

      // ip2 should still have full allowance
      expect(rateLimiter.checkEventLimit(ip2)).toBe(true);
    });

    it('should return correct event rate', () => {
      const ip = '192.168.1.1';

      rateLimiter.checkEventLimit(ip);
      rateLimiter.checkEventLimit(ip);
      rateLimiter.checkEventLimit(ip);

      expect(rateLimiter.getEventRate(ip)).toBe(3);
    });

    it('should return 0 for unknown IP', () => {
      expect(rateLimiter.getEventRate('unknown')).toBe(0);
    });
  });

  describe('Per-Pubkey Rate Limiting', () => {
    it('should allow events within pubkey rate limit', () => {
      const pubkey = 'abc123';

      // Should allow up to the limit
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.checkPubkeyEventLimit(pubkey)).toBe(true);
      }
    });

    it('should block events exceeding pubkey rate limit', () => {
      const pubkey = 'abc123';

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey);
      }

      // 6th event should be blocked
      expect(rateLimiter.checkPubkeyEventLimit(pubkey)).toBe(false);
    });

    it('should track different pubkeys independently', () => {
      const pubkey1 = 'abc123';
      const pubkey2 = 'def456';

      // Use up limit for pubkey1
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey1);
      }

      // pubkey2 should still have full allowance
      expect(rateLimiter.checkPubkeyEventLimit(pubkey2)).toBe(true);
    });

    it('should return correct pubkey event rate', () => {
      const pubkey = 'abc123';

      rateLimiter.checkPubkeyEventLimit(pubkey);
      rateLimiter.checkPubkeyEventLimit(pubkey);

      expect(rateLimiter.getPubkeyEventRate(pubkey)).toBe(2);
    });

    it('should return 0 for unknown pubkey', () => {
      expect(rateLimiter.getPubkeyEventRate('unknown')).toBe(0);
    });
  });

  describe('Combined Rate Limiting (checkEventLimits)', () => {
    it('should allow when both IP and pubkey are within limits', () => {
      const ip = '192.168.1.1';
      const pubkey = 'abc123';

      const result = rateLimiter.checkEventLimits(ip, pubkey);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block when IP exceeds limit', () => {
      const ip = '192.168.1.1';
      const pubkey = 'abc123';

      // Use up IP limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip);
      }

      const result = rateLimiter.checkEventLimits(ip, pubkey);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('IP');
    });

    it('should block when pubkey exceeds limit', () => {
      const ip = '192.168.1.1';
      const pubkey = 'abc123';

      // Use up pubkey limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey);
      }

      const result = rateLimiter.checkEventLimits(ip, pubkey);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('pubkey');
    });

    it('should check IP limit before pubkey limit', () => {
      const ip = '192.168.1.1';
      const pubkey = 'abc123';

      // Use up both limits
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip);
      }
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey);
      }

      const result = rateLimiter.checkEventLimits(ip, pubkey);

      // Should return IP error first
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('IP');
    });
  });

  describe('Connection Tracking', () => {
    it('should track connections', () => {
      const ip = '192.168.1.1';

      expect(rateLimiter.trackConnection(ip)).toBe(true);
      expect(rateLimiter.getConnectionCount(ip)).toBe(1);
    });

    it('should block when connection limit exceeded', () => {
      const ip = '192.168.1.1';

      // Add connections up to limit
      for (let i = 0; i < 20; i++) {
        expect(rateLimiter.trackConnection(ip)).toBe(true);
      }

      // 21st connection should be blocked
      expect(rateLimiter.trackConnection(ip)).toBe(false);
    });

    it('should release connections', () => {
      const ip = '192.168.1.1';

      rateLimiter.trackConnection(ip);
      rateLimiter.trackConnection(ip);
      expect(rateLimiter.getConnectionCount(ip)).toBe(2);

      rateLimiter.releaseConnection(ip);
      expect(rateLimiter.getConnectionCount(ip)).toBe(1);
    });

    it('should not go below zero connections', () => {
      const ip = '192.168.1.1';

      rateLimiter.releaseConnection(ip);
      rateLimiter.releaseConnection(ip);

      expect(rateLimiter.getConnectionCount(ip)).toBe(0);
    });
  });

  describe('Reset Functions', () => {
    it('should reset IP rate limits', () => {
      const ip = '192.168.1.1';

      // Use up limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip);
      }
      expect(rateLimiter.checkEventLimit(ip)).toBe(false);

      rateLimiter.resetIP(ip);

      expect(rateLimiter.checkEventLimit(ip)).toBe(true);
    });

    it('should reset pubkey rate limits', () => {
      const pubkey = 'abc123';

      // Use up limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey);
      }
      expect(rateLimiter.checkPubkeyEventLimit(pubkey)).toBe(false);

      rateLimiter.resetPubkey(pubkey);

      expect(rateLimiter.checkPubkeyEventLimit(pubkey)).toBe(true);
    });

    it('should reset all rate limits', () => {
      const ip = '192.168.1.1';
      const pubkey = 'abc123';

      // Use up limits
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkEventLimit(ip);
      }
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkPubkeyEventLimit(pubkey);
      }
      rateLimiter.trackConnection(ip);

      rateLimiter.resetAll();

      expect(rateLimiter.checkEventLimit(ip)).toBe(true);
      expect(rateLimiter.checkPubkeyEventLimit(pubkey)).toBe(true);
      expect(rateLimiter.getConnectionCount(ip)).toBe(0);
    });
  });

  describe('Stats', () => {
    it('should return accurate statistics', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      const pubkey1 = 'abc123';
      const pubkey2 = 'def456';

      rateLimiter.checkEventLimit(ip1);
      rateLimiter.checkEventLimit(ip2);
      rateLimiter.checkPubkeyEventLimit(pubkey1);
      rateLimiter.checkPubkeyEventLimit(pubkey2);
      rateLimiter.trackConnection(ip1);
      rateLimiter.trackConnection(ip1);

      const stats = rateLimiter.getStats();

      expect(stats.trackedIPs).toBe(3); // 2 event windows + 1 connection tracker
      expect(stats.trackedPubkeys).toBe(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.config.eventsPerSecond).toBe(10);
      expect(stats.config.eventsPerSecondPerPubkey).toBe(5);
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment defaults when no config provided', () => {
      const defaultLimiter = new RateLimiter();
      const stats = defaultLimiter.getStats();

      // Should use env defaults or fallback defaults
      expect(stats.config.eventsPerSecond).toBeDefined();
      expect(stats.config.eventsPerSecondPerPubkey).toBeDefined();
      expect(stats.config.maxConcurrentConnections).toBeDefined();

      defaultLimiter.destroy();
    });

    it('should override defaults with provided config', () => {
      const customLimiter = new RateLimiter({
        eventsPerSecond: 100,
        eventsPerSecondPerPubkey: 50,
      });

      const stats = customLimiter.getStats();
      expect(stats.config.eventsPerSecond).toBe(100);
      expect(stats.config.eventsPerSecondPerPubkey).toBe(50);

      customLimiter.destroy();
    });
  });
});
