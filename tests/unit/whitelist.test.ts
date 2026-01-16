/**
 * Unit Tests: Whitelist Module
 *
 * Tests for whitelist verification logic:
 * - checkWhitelistStatus function
 * - verifyWhitelistStatus function
 * - Cache behavior
 * - Fallback handling
 * - Admin verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test pubkeys
const TEST_PUBKEYS = {
  ADMIN: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  WHITELISTED: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  NON_WHITELISTED: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  BUSINESS: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'
};

// Mock fetch responses
const mockApiResponses = {
  admin: {
    isWhitelisted: true,
    isAdmin: true,
    cohorts: ['admin', 'approved'],
    verifiedAt: Date.now()
  },
  whitelisted: {
    isWhitelisted: true,
    isAdmin: false,
    cohorts: ['approved'],
    verifiedAt: Date.now()
  },
  nonWhitelisted: {
    isWhitelisted: false,
    isAdmin: false,
    cohorts: [],
    verifiedAt: Date.now()
  },
  business: {
    isWhitelisted: true,
    isAdmin: false,
    cohorts: ['approved', 'business'],
    verifiedAt: Date.now()
  }
};

// Mock browser environment and fetch
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock environment variables
vi.stubEnv('VITE_RELAY_URL', 'wss://test-relay.example.com');
vi.stubEnv('VITE_ADMIN_PUBKEY', TEST_PUBKEYS.ADMIN);

describe('Whitelist Module', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset modules to clear cache
    vi.resetModules();

    // Setup fetch mock
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Clear any module cache
    vi.doUnmock('$lib/nostr/whitelist');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('verifyWhitelistStatus', () => {
    it('should return whitelisted status for admin user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.admin)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.ADMIN);

      expect(status.isWhitelisted).toBe(true);
      expect(status.isAdmin).toBe(true);
      expect(status.cohorts).toContain('admin');
    });

    it('should return whitelisted status for approved user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(status.isWhitelisted).toBe(true);
      expect(status.isAdmin).toBe(false);
      expect(status.cohorts).toContain('approved');
    });

    it('should return not whitelisted for unapproved user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.nonWhitelisted)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.NON_WHITELISTED);

      expect(status.isWhitelisted).toBe(false);
      expect(status.isAdmin).toBe(false);
      expect(status.cohorts).toHaveLength(0);
    });

    it('should handle API failure with fallback', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.ADMIN);

      expect(status.source).toBe('fallback');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle network error with fallback', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.NON_WHITELISTED);

      expect(status.source).toBe('fallback');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should call correct API endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/check-whitelist'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should include pubkey in query string', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain(`pubkey=${TEST_PUBKEYS.WHITELISTED}`);
    });

    it('should return fallback for empty pubkey', async () => {
      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus('');

      expect(status.source).toBe('fallback');
      expect(status.isWhitelisted).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Cache Behavior', () => {
    it('should cache status and return from cache on subsequent calls', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');

      // First call - should hit API
      const status1 = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      expect(status1.source).toBe('relay');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const status2 = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      expect(status2.source).toBe('cache');
      expect(fetchMock).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should clear cache when clearWhitelistCache is called', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus, clearWhitelistCache } = await import('$lib/nostr/whitelist');

      // Populate cache
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Clear cache for specific user
      clearWhitelistCache(TEST_PUBKEYS.WHITELISTED);

      // Should hit API again
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache when clearWhitelistCache called without argument', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyWhitelistStatus, clearWhitelistCache } = await import('$lib/nostr/whitelist');

      // Populate cache for multiple users
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      await verifyWhitelistStatus(TEST_PUBKEYS.ADMIN);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Clear all cache
      clearWhitelistCache();

      // Both should hit API again
      await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);
      await verifyWhitelistStatus(TEST_PUBKEYS.ADMIN);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe('checkWhitelistStatus', () => {
    it('should return isApproved true for whitelisted user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { checkWhitelistStatus } = await import('$lib/nostr/whitelist');
      const result = await checkWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(result.isApproved).toBe(true);
      expect(result.isAdmin).toBe(false);
    });

    it('should return isApproved false for non-whitelisted user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.nonWhitelisted)
      });

      const { checkWhitelistStatus } = await import('$lib/nostr/whitelist');
      const result = await checkWhitelistStatus(TEST_PUBKEYS.NON_WHITELISTED);

      expect(result.isApproved).toBe(false);
      expect(result.isAdmin).toBe(false);
    });

    it('should return both isApproved and isAdmin true for admin', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.admin)
      });

      const { checkWhitelistStatus } = await import('$lib/nostr/whitelist');
      const result = await checkWhitelistStatus(TEST_PUBKEYS.ADMIN);

      expect(result.isApproved).toBe(true);
      expect(result.isAdmin).toBe(true);
    });
  });

  describe('verifyAdminStatus', () => {
    it('should return true for admin user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.admin)
      });

      const { verifyAdminStatus } = await import('$lib/nostr/whitelist');
      const isAdmin = await verifyAdminStatus(TEST_PUBKEYS.ADMIN);

      expect(isAdmin).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyAdminStatus } = await import('$lib/nostr/whitelist');
      const isAdmin = await verifyAdminStatus(TEST_PUBKEYS.WHITELISTED);

      expect(isAdmin).toBe(false);
    });
  });

  describe('verifyCohortMembership', () => {
    it('should return true for user in cohort', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.business)
      });

      const { verifyCohortMembership } = await import('$lib/nostr/whitelist');
      const isMember = await verifyCohortMembership(TEST_PUBKEYS.BUSINESS, 'business');

      expect(isMember).toBe(true);
    });

    it('should return false for user not in cohort', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.whitelisted)
      });

      const { verifyCohortMembership } = await import('$lib/nostr/whitelist');
      const isMember = await verifyCohortMembership(TEST_PUBKEYS.WHITELISTED, 'business');

      expect(isMember).toBe(false);
    });

    it('should return true for admin in admin cohort', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.admin)
      });

      const { verifyCohortMembership } = await import('$lib/nostr/whitelist');
      const isMember = await verifyCohortMembership(TEST_PUBKEYS.ADMIN, 'admin');

      expect(isMember).toBe(true);
    });
  });

  describe('getUserCohorts', () => {
    it('should return all cohorts for user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.admin)
      });

      const { getUserCohorts } = await import('$lib/nostr/whitelist');
      const cohorts = await getUserCohorts(TEST_PUBKEYS.ADMIN);

      expect(cohorts).toContain('admin');
      expect(cohorts).toContain('approved');
    });

    it('should return empty array for non-whitelisted user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponses.nonWhitelisted)
      });

      const { getUserCohorts } = await import('$lib/nostr/whitelist');
      const cohorts = await getUserCohorts(TEST_PUBKEYS.NON_WHITELISTED);

      expect(cohorts).toHaveLength(0);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use VITE_ADMIN_PUBKEY for fallback admin check', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      // Re-import to get fresh module with env var
      vi.stubEnv('VITE_ADMIN_PUBKEY', TEST_PUBKEYS.ADMIN);

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.ADMIN);

      expect(status.source).toBe('fallback');
      expect(status.isAdmin).toBe(true);
      expect(status.isWhitelisted).toBe(true);
    });

    it('should handle multiple admin pubkeys in env var', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const secondAdmin = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      vi.stubEnv('VITE_ADMIN_PUBKEY', `${TEST_PUBKEYS.ADMIN},${secondAdmin}`);

      vi.resetModules();
      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(secondAdmin);

      expect(status.source).toBe('fallback');
      expect(status.isAdmin).toBe(true);
    });

    it('should return false for non-admin in fallback mode', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.NON_WHITELISTED);

      expect(status.source).toBe('fallback');
      expect(status.isAdmin).toBe(false);
      expect(status.isWhitelisted).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle API returning null/undefined values', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          // All values missing/undefined
        })
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(status.isWhitelisted).toBe(false);
      expect(status.isAdmin).toBe(false);
      expect(status.cohorts).toEqual([]);
    });

    it('should include verifiedAt timestamp', async () => {
      const mockTime = 1704067200000; // 2024-01-01
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          ...mockApiResponses.whitelisted,
          verifiedAt: mockTime
        })
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(status.verifiedAt).toBe(mockTime);
    });

    it('should generate verifiedAt if not provided by API', async () => {
      const beforeCall = Date.now();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          isWhitelisted: true,
          isAdmin: false,
          cohorts: ['approved']
          // No verifiedAt
        })
      });

      const { verifyWhitelistStatus } = await import('$lib/nostr/whitelist');
      const status = await verifyWhitelistStatus(TEST_PUBKEYS.WHITELISTED);

      expect(status.verifiedAt).toBeGreaterThanOrEqual(beforeCall);
    });
  });
});
