/**
 * Profile synchronization utilities
 *
 * Provides reliable profile indexing confirmation to prevent race conditions
 * during user registration (ADR-001 fix for circular dependency).
 */

import { browser } from '$app/environment';

// Get relay URL from environment (GCP Cloud Run relay)
const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'wss://nostr-relay-617806532906.us-central1.run.app';

/**
 * Convert WebSocket URL to HTTP URL for API calls
 */
function getRelayHttpUrl(): string {
  return RELAY_URL.replace('wss://', 'https://').replace('ws://', 'http://');
}

/**
 * Wait for a profile (Kind 0) to be indexed by the relay
 *
 * Uses exponential backoff polling to confirm the profile event
 * has been saved before publishing dependent events (like Kind 9024 registration).
 *
 * This fixes the fragile 300ms delay race condition documented in task.md.
 *
 * @param pubkey - User's public key (64-char hex)
 * @param expectedName - Expected display name from the profile (optional)
 * @param maxWaitMs - Maximum wait time in milliseconds (default 5000)
 * @returns true if profile was confirmed indexed, false if timeout
 */
export async function waitForProfileIndexing(
  pubkey: string,
  expectedName?: string,
  maxWaitMs: number = 5000
): Promise<boolean> {
  if (!browser) {
    return true; // SSR - assume success
  }

  // Validate pubkey format
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    console.warn('[ProfileSync] Invalid pubkey format');
    return false;
  }

  const startTime = Date.now();
  let attemptDelay = 100; // Start with 100ms
  let attempts = 0;
  const maxAttempts = 10; // Safety limit

  while (Date.now() - startTime < maxWaitMs && attempts < maxAttempts) {
    attempts++;

    try {
      const profile = await fetchProfileFromRelay(pubkey);

      if (profile) {
        // Profile exists - optionally verify the name matches
        if (expectedName) {
          const profileName = profile.name || profile.display_name || '';
          if (profileName.toLowerCase().includes(expectedName.toLowerCase())) {
            if (import.meta.env.DEV) {
              console.log(`[ProfileSync] Profile confirmed after ${attempts} attempts (${Date.now() - startTime}ms)`);
            }
            return true;
          }
          // Name doesn't match yet - profile might be stale, retry
        } else {
          // No name check required - profile exists
          if (import.meta.env.DEV) {
            console.log(`[ProfileSync] Profile found after ${attempts} attempts (${Date.now() - startTime}ms)`);
          }
          return true;
        }
      }

      // Profile not found or name mismatch - wait with exponential backoff
      await sleep(attemptDelay);
      attemptDelay = Math.min(attemptDelay * 2, 1000); // Cap at 1 second
    } catch (error) {
      // Network error - continue retrying
      if (import.meta.env.DEV) {
        console.warn(`[ProfileSync] Attempt ${attempts} failed:`, error);
      }
      await sleep(attemptDelay);
      attemptDelay = Math.min(attemptDelay * 2, 1000);
    }
  }

  // Timeout reached - proceed anyway (don't block UX indefinitely)
  console.warn(`[ProfileSync] Timeout after ${attempts} attempts (${Date.now() - startTime}ms)`);
  return false;
}

/**
 * Fetch profile metadata from relay via HTTP API
 *
 * Makes a lightweight query for Kind 0 events for the given pubkey.
 */
async function fetchProfileFromRelay(pubkey: string): Promise<ProfileMetadata | null> {
  const httpUrl = getRelayHttpUrl();

  try {
    // Use the relay's profile endpoint if available, otherwise fall back to events query
    const response = await fetch(`${httpUrl}/api/profile?pubkey=${encodeURIComponent(pubkey)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(2000) // 2 second timeout per request
    });

    if (response.ok) {
      const data = await response.json();
      return data as ProfileMetadata;
    }

    // Endpoint might not exist - try alternative approach via events
    if (response.status === 404) {
      return await fetchProfileViaEvents(pubkey, httpUrl);
    }

    return null;
  } catch (error) {
    // If /api/profile doesn't exist, try events approach
    if (error instanceof TypeError) {
      return await fetchProfileViaEvents(pubkey, httpUrl);
    }
    throw error;
  }
}

/**
 * Fallback: fetch profile by querying events endpoint
 */
async function fetchProfileViaEvents(pubkey: string, httpUrl: string): Promise<ProfileMetadata | null> {
  try {
    // Query for Kind 0 events from this author
    const response = await fetch(`${httpUrl}/api/events?authors=${encodeURIComponent(pubkey)}&kinds=0&limit=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(2000)
    });

    if (response.ok) {
      const events = await response.json();
      if (Array.isArray(events) && events.length > 0) {
        const content = events[0].content;
        try {
          return JSON.parse(content) as ProfileMetadata;
        } catch {
          return null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Profile metadata interface (NIP-01 Kind 0)
 */
interface ProfileMetadata {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
}
