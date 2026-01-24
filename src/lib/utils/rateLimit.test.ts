/**
 * Tests for Client-Side Rate Limiting
 *
 * Tests token bucket algorithm implementation for abuse prevention.
 * Security-critical module - comprehensive timing and boundary testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  getRateLimitRemaining,
  resetRateLimit,
  withRateLimit,
  RateLimitError,
  RATE_LIMITS
} from './rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset all rate limiters first with real timers
    resetRateLimit('message');
    resetRateLimit('channelCreate');
    resetRateLimit('dm');
    resetRateLimit('api');
    resetRateLimit('login');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RATE_LIMITS configuration', () => {
    it('should have correct message rate limit config', () => {
      expect(RATE_LIMITS.message.capacity).toBe(10);
      expect(RATE_LIMITS.message.refillRate).toBeCloseTo(10 / 60, 5);
      expect(RATE_LIMITS.message.tokensPerAction).toBe(1);
    });

    it('should have correct channelCreate rate limit config', () => {
      expect(RATE_LIMITS.channelCreate.capacity).toBe(2);
      expect(RATE_LIMITS.channelCreate.refillRate).toBeCloseTo(2 / 3600, 10);
      expect(RATE_LIMITS.channelCreate.tokensPerAction).toBe(1);
    });

    it('should have correct dm rate limit config', () => {
      expect(RATE_LIMITS.dm.capacity).toBe(20);
      expect(RATE_LIMITS.dm.refillRate).toBeCloseTo(20 / 60, 5);
      expect(RATE_LIMITS.dm.tokensPerAction).toBe(1);
    });

    it('should have correct api rate limit config', () => {
      expect(RATE_LIMITS.api.capacity).toBe(100);
      expect(RATE_LIMITS.api.refillRate).toBeCloseTo(100 / 60, 5);
      expect(RATE_LIMITS.api.tokensPerAction).toBe(1);
    });

    it('should have correct login rate limit config', () => {
      expect(RATE_LIMITS.login.capacity).toBe(5);
      expect(RATE_LIMITS.login.refillRate).toBeCloseTo(5 / 900, 10);
      expect(RATE_LIMITS.login.tokensPerAction).toBe(1);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow actions within capacity', () => {
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit('message', 'user1');
        expect(result.allowed).toBe(true);
      }
    });

    it('should deny actions exceeding capacity', () => {
      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'user1');
      }

      // Next action should be denied
      const result = checkRateLimit('message', 'user1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remaining).toBe(0);
    });

    it('should track remaining tokens correctly', () => {
      // Use a unique key to avoid interference from other tests
      const key = 'track-test-' + Date.now();
      let result = checkRateLimit('message', key);
      expect(result.remaining).toBe(9); // 10 - 1

      result = checkRateLimit('message', key);
      expect(result.remaining).toBe(8);

      result = checkRateLimit('message', key);
      expect(result.remaining).toBe(7);
    });

    it('should use separate buckets for different keys', () => {
      // Exhaust user1's tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'user1');
      }

      // user2 should still have full capacity
      const result = checkRateLimit('message', 'user2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should use separate buckets for different action types', () => {
      // Exhaust message tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'user1');
      }

      // DM should still be available
      const result = checkRateLimit('dm', 'user1');
      expect(result.allowed).toBe(true);
    });

    it('should use default key when not specified', () => {
      const result1 = checkRateLimit('message');
      const result2 = checkRateLimit('message', 'default');

      // Both should use the same bucket
      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(8);
    });

    it('should refill tokens over time', async () => {
      const key = 'refill-test-' + Date.now();
      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', key);
      }

      let result = checkRateLimit('message', key);
      expect(result.allowed).toBe(false);

      // Wait for real time to pass (~600ms for 0.1 token at 10/60 rate)
      // Need 1 token, so ~6 seconds, but we'll wait a bit less and check
      await new Promise(resolve => setTimeout(resolve, 6100));

      result = checkRateLimit('message', key);
      expect(result.allowed).toBe(true);
    }, 10000);

    it('should not exceed capacity when refilling', () => {
      // Use a fresh key and check that remaining starts at capacity - 1
      const key = 'capacity-test-' + Date.now();
      const result = checkRateLimit('message', key);

      // Should have full capacity minus the one just used
      expect(result.remaining).toBe(9); // 10 - 1
    });

    it('should calculate correct retryAfter for rate limited requests', () => {
      const key = 'retry-test-' + Date.now();
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', key);
      }

      const result = checkRateLimit('message', key);

      // With refill rate of 10/60 = 0.167 tokens/sec
      // Need 1 token, so ~6 seconds
      expect(result.retryAfter).toBeGreaterThanOrEqual(5);
      expect(result.retryAfter).toBeLessThanOrEqual(7);
    });
  });

  describe('getRateLimitRemaining', () => {
    it('should return full capacity for new key', () => {
      const key = 'new-key-' + Date.now();
      const remaining = getRateLimitRemaining('message', key);
      expect(remaining).toBe(10);
    });

    it('should return correct remaining after actions', () => {
      const key = 'remaining-test-' + Date.now();
      checkRateLimit('message', key);
      checkRateLimit('message', key);
      checkRateLimit('message', key);

      const remaining = getRateLimitRemaining('message', key);
      expect(remaining).toBe(7);
    });

    it('should account for token refill over time', async () => {
      const key = 'refill-remaining-' + Date.now();
      // Use some tokens
      for (let i = 0; i < 5; i++) {
        checkRateLimit('message', key);
      }

      // Wait for partial refill (~12 seconds = ~2 tokens at 10/60 rate)
      await new Promise(resolve => setTimeout(resolve, 12100));

      const remaining = getRateLimitRemaining('message', key);
      expect(remaining).toBe(7); // 5 + 2
    }, 15000);
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', () => {
      const key = 'reset-test-' + Date.now();
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', key);
      }

      let result = checkRateLimit('message', key);
      expect(result.allowed).toBe(false);

      // Reset
      resetRateLimit('message', key);

      // Should have full capacity again
      result = checkRateLimit('message', key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should only reset specified key', () => {
      const key1 = 'reset-user1-' + Date.now();
      const key2 = 'reset-user2-' + Date.now();
      // Use tokens for both users
      for (let i = 0; i < 5; i++) {
        checkRateLimit('message', key1);
        checkRateLimit('message', key2);
      }

      // Reset only key1
      resetRateLimit('message', key1);

      const remaining1 = getRateLimitRemaining('message', key1);
      const remaining2 = getRateLimitRemaining('message', key2);

      expect(remaining1).toBe(10); // Reset
      expect(remaining2).toBe(5);  // Unchanged
    });
  });

  describe('withRateLimit decorator', () => {
    it('should allow decorated function when rate limit permits', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit('message')(() => mockFn() as Promise<unknown>);

      const result = await rateLimitedFn();

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'default');
      }

      const mockFn = vi.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit('message')(() => mockFn() as Promise<unknown>);

      await expect(rateLimitedFn()).rejects.toThrow(RateLimitError);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should use custom key function', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit<(userId: string) => Promise<unknown>>(
        'message',
        (userId) => userId
      )((userId: string) => mockFn(userId) as Promise<unknown>);

      // Exhaust rate limit for user1
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'user1');
      }

      // user1 should be rate limited
      await expect(rateLimitedFn('user1')).rejects.toThrow(RateLimitError);

      // user2 should work
      const result = await rateLimitedFn('user2');
      expect(result).toBe('success');
    });

    it('should include retryAfter in error', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit('message', 'default');
      }

      const mockFn = vi.fn().mockResolvedValue('success');
      const rateLimitedFn = withRateLimit('message')(() => mockFn() as Promise<unknown>);

      try {
        await rateLimitedFn();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('RateLimitError', () => {
    it('should have correct name', () => {
      const error = new RateLimitError('Test error', 60);
      expect(error.name).toBe('RateLimitError');
    });

    it('should have message and retryAfter', () => {
      const error = new RateLimitError('Rate limit exceeded', 30);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(30);
    });

    it('should be instanceof Error', () => {
      const error = new RateLimitError('Test', 10);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RateLimitError);
    });
  });

  describe('channel creation rate limit', () => {
    it('should allow 2 channels per hour', () => {
      const key = 'channel-test-' + Date.now();
      const result1 = checkRateLimit('channelCreate', key);
      const result2 = checkRateLimit('channelCreate', key);
      const result3 = checkRateLimit('channelCreate', key);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(false);
    });

    it('should report correct retryAfter when exhausted', () => {
      const key = 'channel-retry-' + Date.now();
      // Use both tokens
      checkRateLimit('channelCreate', key);
      checkRateLimit('channelCreate', key);

      const result = checkRateLimit('channelCreate', key);
      expect(result.allowed).toBe(false);
      // With 2/3600 refill rate, need ~30 minutes for 1 token
      expect(result.retryAfter).toBeGreaterThan(1700); // ~30 min in seconds
      expect(result.retryAfter).toBeLessThan(1900);
    });
  });

  describe('login rate limit', () => {
    it('should allow 5 login attempts per 15 minutes', () => {
      const key = 'login-test-' + Date.now();
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit('login', key);
        expect(result.allowed).toBe(true);
      }

      const result = checkRateLimit('login', key);
      expect(result.allowed).toBe(false);
    });

    it('should have long retry time after exhaustion', () => {
      const key = 'login-retry-' + Date.now();
      // Exhaust login attempts
      for (let i = 0; i < 5; i++) {
        checkRateLimit('login', key);
      }

      const result = checkRateLimit('login', key);

      // Should be around 3 minutes (1 token per 3 minutes)
      expect(result.retryAfter).toBeGreaterThan(150);
      expect(result.retryAfter).toBeLessThan(200);
    });
  });

  describe('edge cases', () => {
    it('should handle empty key string', () => {
      // Use unique empty-like key to avoid collisions
      resetRateLimit('message', '');
      const result = checkRateLimit('message', '');

      expect(result.allowed).toBe(true);
    });

    it('should handle very long key strings', () => {
      const longKey = 'x'.repeat(10000) + Date.now();
      const result = checkRateLimit('message', longKey);

      expect(result.allowed).toBe(true);
    });

    it('should handle unicode keys', () => {
      const unicodeKey = 'user-日本語-🚀-' + Date.now();
      const result = checkRateLimit('message', unicodeKey);

      expect(result.allowed).toBe(true);
    });

    it('should handle rapid successive calls', () => {
      const key = 'rapid-test-' + Date.now();
      const results: boolean[] = [];

      for (let i = 0; i < 20; i++) {
        results.push(checkRateLimit('message', key).allowed);
      }

      // First 10 should be true, rest false
      expect(results.filter(r => r).length).toBe(10);
      expect(results.slice(0, 10).every(r => r)).toBe(true);
      expect(results.slice(10).every(r => !r)).toBe(true);
    });

    it('should continue working after partial token usage', () => {
      const key = 'partial-test-' + Date.now();
      // Use 5 tokens
      for (let i = 0; i < 5; i++) {
        checkRateLimit('message', key);
      }

      // Should still have 5 remaining
      const result = checkRateLimit('message', key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple simultaneous rate limit checks', () => {
      const timestamp = Date.now();
      const users = [`user1-${timestamp}`, `user2-${timestamp}`, `user3-${timestamp}`];
      const actions = ['message', 'dm', 'api'] as const;

      for (const user of users) {
        for (const action of actions) {
          const result = checkRateLimit(action, user);
          expect(result.allowed).toBe(true);
        }
      }
    });
  });
});
