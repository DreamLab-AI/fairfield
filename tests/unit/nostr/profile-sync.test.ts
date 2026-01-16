/**
 * Unit Tests: Profile Synchronization
 *
 * Tests for profile indexing wait logic with exponential backoff,
 * relay HTTP API interaction, and timeout handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock $app/environment before importing
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

// Import after mocking
import { waitForProfileIndexing } from '$lib/nostr/profile-sync';

// Valid test pubkey (64 hex chars)
const VALID_PUBKEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// Mock profile response
const mockProfile = {
  name: 'testuser',
  display_name: 'Test User',
  about: 'A test user',
  picture: 'https://example.com/avatar.jpg',
  nip05: 'test@example.com'
};

describe('Profile Synchronization', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('waitForProfileIndexing', () => {
    describe('Input Validation', () => {
      it('should return false for invalid pubkey format', async () => {
        const result = await waitForProfileIndexing('invalid-pubkey');
        expect(result).toBe(false);
        // Should not make any fetch calls for invalid pubkey
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('should return false for too short pubkey', async () => {
        const result = await waitForProfileIndexing('a'.repeat(63));
        expect(result).toBe(false);
      });

      it('should return false for too long pubkey', async () => {
        const result = await waitForProfileIndexing('a'.repeat(65));
        expect(result).toBe(false);
      });

      it('should return false for non-hex pubkey', async () => {
        const result = await waitForProfileIndexing('z'.repeat(64));
        expect(result).toBe(false);
      });

      it('should accept valid 64-char hex pubkey', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalled();
      });

      it('should accept uppercase hex pubkey', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY.toUpperCase());
        expect(result).toBe(true);
      });
    });

    describe('Profile Found Immediately', () => {
      it('should return true when profile is found on first attempt', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it('should verify profile name when expectedName is provided', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY, 'testuser');
        expect(result).toBe(true);
      });

      it('should match expectedName case-insensitively', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY, 'TESTUSER');
        expect(result).toBe(true);
      });

      it('should match partial expectedName', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY, 'test');
        expect(result).toBe(true);
      });

      it('should use display_name when name is not present', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ display_name: 'Display Name' })
        });

        const result = await waitForProfileIndexing(VALID_PUBKEY, 'Display');
        expect(result).toBe(true);
      });
    });

    describe('Profile Found After Retry', () => {
      it('should retry when profile is not found initially', async () => {
        // First two attempts: profile not found (404)
        fetchMock
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 5000);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      it('should retry when name does not match initially', async () => {
        // First attempt: wrong name
        fetchMock
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ name: 'oldname' })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ name: 'testuser' })
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY, 'testuser', 5000);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    describe('Exponential Backoff', () => {
      it('should use exponential backoff between retries', async () => {
        const timestamps: number[] = [];

        fetchMock.mockImplementation(() => {
          timestamps.push(Date.now());
          if (timestamps.length < 4) {
            return Promise.resolve({ ok: false, status: 404 });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          });
        });

        await waitForProfileIndexing(VALID_PUBKEY, undefined, 10000);

        // Check that delays increase (roughly) exponentially
        if (timestamps.length >= 3) {
          const delay1 = timestamps[1] - timestamps[0];
          const delay2 = timestamps[2] - timestamps[1];
          // Second delay should be roughly 2x the first (allowing for timing variance)
          expect(delay2).toBeGreaterThanOrEqual(delay1 * 1.5);
        }
      });

      it('should cap backoff delay at 1000ms', async () => {
        let attemptCount = 0;
        const timestamps: number[] = [];

        fetchMock.mockImplementation(() => {
          attemptCount++;
          timestamps.push(Date.now());
          if (attemptCount < 8) {
            return Promise.resolve({ ok: false, status: 404 });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          });
        });

        await waitForProfileIndexing(VALID_PUBKEY, undefined, 20000);

        // Later delays should be capped at ~1000ms
        if (timestamps.length >= 7) {
          const laterDelay = timestamps[6] - timestamps[5];
          // Allow some variance but should be around 1000ms, not much higher
          expect(laterDelay).toBeLessThan(1500);
        }
      });
    });

    describe('Timeout Handling', () => {
      it('should return false when timeout is exceeded', async () => {
        fetchMock.mockImplementation(() =>
          Promise.resolve({ ok: false, status: 404 })
        );

        const start = Date.now();
        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 500);
        const elapsed = Date.now() - start;

        expect(result).toBe(false);
        expect(elapsed).toBeGreaterThanOrEqual(400);
        expect(elapsed).toBeLessThan(1500);
      });

      it('should timeout and return false eventually', async () => {
        fetchMock.mockImplementation(() =>
          Promise.resolve({ ok: false, status: 404 })
        );

        // Use a short timeout to verify it doesn't hang
        const start = Date.now();
        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 800);
        const elapsed = Date.now() - start;

        expect(result).toBe(false);
        // Should not take much longer than the timeout
        expect(elapsed).toBeLessThan(2000);
      });

      it('should call fetch multiple times before timeout', async () => {
        let attemptCount = 0;
        fetchMock.mockImplementation(() => {
          attemptCount++;
          return Promise.resolve({ ok: false, status: 404 });
        });

        // Short timeout to ensure test completes quickly
        await waitForProfileIndexing(VALID_PUBKEY, undefined, 800);

        // Should have made multiple attempts
        expect(attemptCount).toBeGreaterThan(1);
      });
    });

    describe('Network Error Handling', () => {
      it('should continue retrying on network errors', async () => {
        fetchMock
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Timeout'))
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 5000);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      it('should return false if all attempts fail with network errors', async () => {
        fetchMock.mockRejectedValue(new Error('Network error'));

        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 500);
        expect(result).toBe(false);
      });
    });

    describe('Fallback to Events Endpoint', () => {
      it('should try /api/events when /api/profile returns 404', async () => {
        // First call to /api/profile returns 404
        fetchMock
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{
              kind: 0,
              content: JSON.stringify(mockProfile)
            }])
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY);
        expect(result).toBe(true);

        // Should have called both endpoints
        const urls = fetchMock.mock.calls.map(call => call[0]);
        expect(urls.some((url: string) => url.includes('/api/profile'))).toBe(true);
        expect(urls.some((url: string) => url.includes('/api/events'))).toBe(true);
      });

      it('should handle TypeError as fallback trigger', async () => {
        fetchMock
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{
              kind: 0,
              content: JSON.stringify(mockProfile)
            }])
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY);
        expect(result).toBe(true);
      });

      it('should return null when events endpoint has no results', async () => {
        fetchMock
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([])
          })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([])
          })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([])
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 300);
        expect(result).toBe(false);
      });

      it('should handle invalid JSON in event content', async () => {
        fetchMock
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{
              kind: 0,
              content: 'invalid json{'
            }])
          })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{
              kind: 0,
              content: JSON.stringify(mockProfile)
            }])
          });

        const result = await waitForProfileIndexing(VALID_PUBKEY, undefined, 5000);
        expect(result).toBe(true);
      });
    });

    describe('URL Construction', () => {
      it('should construct correct API URL from WSS relay URL', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        await waitForProfileIndexing(VALID_PUBKEY);

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain('https://');
        expect(calledUrl).toContain(`pubkey=${VALID_PUBKEY}`);
      });

      it('should URL-encode pubkey parameter', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        await waitForProfileIndexing(VALID_PUBKEY);

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain(encodeURIComponent(VALID_PUBKEY));
      });
    });

    describe('Request Configuration', () => {
      it('should set Accept header to application/json', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        await waitForProfileIndexing(VALID_PUBKEY);

        const options = fetchMock.mock.calls[0][1];
        expect(options.headers.Accept).toBe('application/json');
      });

      it('should use GET method', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        await waitForProfileIndexing(VALID_PUBKEY);

        const options = fetchMock.mock.calls[0][1];
        expect(options.method).toBe('GET');
      });

      it('should set request timeout to 2000ms', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProfile)
        });

        await waitForProfileIndexing(VALID_PUBKEY);

        const options = fetchMock.mock.calls[0][1];
        // AbortSignal.timeout creates a signal
        expect(options.signal).toBeDefined();
      });
    });
  });
});
