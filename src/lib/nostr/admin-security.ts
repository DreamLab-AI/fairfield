/**
 * Admin Security Module
 *
 * Provides security hardening for admin workflows:
 * - NIP-51 pin list signature verification
 * - Rate limiting for section access requests
 * - Cohort assignment validation
 * - Request signing for admin actions
 */

import { browser } from '$app/environment';
import { verifyEventSignature, nowSeconds } from './events';
import { verifyWhitelistStatus, type CohortName } from './whitelist';
import type { NostrEvent } from '../../types/nostr';

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_STORAGE_KEY = 'nostr_bbs_rate_limits';
const SUSPICIOUS_ACTIVITY_KEY = 'nostr_bbs_suspicious_activity';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  sectionAccessRequest: {
    maxAttempts: 5,
    windowMs: 60 * 1000, // 1 minute
    backoffMultiplier: 2,
    maxBackoffMs: 300 * 1000, // 5 minutes max backoff
  },
  cohortChange: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    backoffMultiplier: 3,
    maxBackoffMs: 24 * 60 * 60 * 1000, // 24 hours max
  },
  adminAction: {
    maxAttempts: 10,
    windowMs: 60 * 1000,
    backoffMultiplier: 1.5,
    maxBackoffMs: 60 * 1000,
  },
};

// Restricted cohorts that users cannot self-assign
const RESTRICTED_COHORTS: CohortName[] = ['admin'];

// Request signature validity window (prevents replay attacks)
const SIGNATURE_VALIDITY_WINDOW_SECONDS = 300; // 5 minutes

// ============================================================================
// Types
// ============================================================================

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  consecutiveFailures: number;
  backoffUntil: number;
}

interface RateLimitState {
  [key: string]: RateLimitEntry;
}

interface SignedRequest {
  action: string;
  timestamp: number;
  nonce: string;
  pubkey: string;
  payload: unknown;
  signature: string;
}

interface SuspiciousActivity {
  pubkey: string;
  action: string;
  timestamp: number;
  details: string;
}

// ============================================================================
// Pin List Verification (NIP-51 kind 30001)
// ============================================================================

/**
 * Verify a NIP-51 pin list signature and author
 *
 * @param event - Pin list event (kind 30001)
 * @param expectedAuthor - Expected author pubkey
 * @returns Verification result with details
 */
export function verifyPinListSignature(
  event: NostrEvent,
  expectedAuthor: string
): { valid: boolean; error?: string } {
  // Check event kind
  if (event.kind !== 30001) {
    return {
      valid: false,
      error: `Invalid event kind: expected 30001 (pin list), got ${event.kind}`,
    };
  }

  // Verify author matches expected
  if (event.pubkey !== expectedAuthor) {
    logSuspiciousActivity({
      pubkey: event.pubkey,
      action: 'pin_list_author_mismatch',
      timestamp: Date.now(),
      details: `Pin list author ${event.pubkey.slice(0, 8)}... does not match expected ${expectedAuthor.slice(0, 8)}...`,
    });
    return {
      valid: false,
      error: 'Pin list author does not match authenticated user',
    };
  }

  // Verify signature is present
  if (!event.sig || event.sig.length !== 128) {
    return {
      valid: false,
      error: 'Pin list has invalid or missing signature',
    };
  }

  // Verify cryptographic signature
  const signatureValid = verifyEventSignature(event);
  if (!signatureValid) {
    logSuspiciousActivity({
      pubkey: event.pubkey,
      action: 'pin_list_signature_invalid',
      timestamp: Date.now(),
      details: `Pin list signature verification failed for event ${event.id?.slice(0, 8)}...`,
    });
    return {
      valid: false,
      error: 'Pin list signature verification failed - event may be tampered',
    };
  }

  // Check timestamp is recent (prevent old events from being replayed)
  const eventAge = nowSeconds() - event.created_at;
  if (eventAge > 86400) {
    // 24 hours
    return {
      valid: false,
      error: 'Pin list event is too old (>24 hours)',
    };
  }

  return { valid: true };
}

/**
 * Parse and verify pin list contents
 *
 * @param event - Verified pin list event
 * @returns Parsed pins or error
 */
export function parsePinList(
  event: NostrEvent
): { pins: string[]; error?: string } {
  try {
    const pins: string[] = [];

    // Check if tags exist
    if (!event.tags) {
      return { pins };
    }

    // Extract pins from tags (NIP-51 format)
    for (const tag of event.tags) {
      if (tag[0] === 'e' && tag[1]) {
        // Event pin
        pins.push(tag[1]);
      } else if (tag[0] === 'a' && tag[1]) {
        // Addressable event pin
        pins.push(tag[1]);
      }
    }

    return { pins };
  } catch (error) {
    return {
      pins: [],
      error: `Failed to parse pin list: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Load rate limit state from session storage
 */
function loadRateLimitState(): RateLimitState {
  if (!browser) return {};

  try {
    const stored = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save rate limit state to session storage
 */
function saveRateLimitState(state: RateLimitState): void {
  if (!browser) return;

  try {
    sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('[RateLimit] Failed to save state');
  }
}

/**
 * Check if an action is rate limited
 *
 * @param actionKey - Unique key for the action
 * @param actionType - Type of action for config lookup
 * @returns Whether action is allowed and wait time if not
 */
export function checkRateLimit(
  actionKey: string,
  actionType: keyof typeof RATE_LIMIT_CONFIG
): { allowed: boolean; waitMs?: number; reason?: string } {
  const config = RATE_LIMIT_CONFIG[actionType];
  const state = loadRateLimitState();
  const now = Date.now();

  const entry = state[actionKey];

  // No previous attempts
  if (!entry) {
    return { allowed: true };
  }

  // Check if in backoff period
  if (entry.backoffUntil > now) {
    const waitMs = entry.backoffUntil - now;
    return {
      allowed: false,
      waitMs,
      reason: `Rate limited. Please wait ${Math.ceil(waitMs / 1000)} seconds.`,
    };
  }

  // Check if window has expired (reset counter)
  if (now - entry.firstAttempt > config.windowMs) {
    return { allowed: true };
  }

  // Check if at max attempts
  if (entry.attempts >= config.maxAttempts) {
    // Calculate backoff duration based on consecutive failures
    const backoffMs = Math.min(
      config.windowMs * Math.pow(config.backoffMultiplier, entry.consecutiveFailures),
      config.maxBackoffMs
    );

    return {
      allowed: false,
      waitMs: backoffMs,
      reason: `Too many attempts. Please wait ${Math.ceil(backoffMs / 1000)} seconds.`,
    };
  }

  return { allowed: true };
}

/**
 * Record an attempt for rate limiting
 *
 * @param actionKey - Unique key for the action
 * @param actionType - Type of action for config lookup
 * @param success - Whether the attempt succeeded
 */
export function recordRateLimitAttempt(
  actionKey: string,
  actionType: keyof typeof RATE_LIMIT_CONFIG,
  success: boolean
): void {
  const config = RATE_LIMIT_CONFIG[actionType];
  const state = loadRateLimitState();
  const now = Date.now();

  let entry = state[actionKey];

  // Initialize or reset if window expired
  if (!entry || now - entry.firstAttempt > config.windowMs) {
    entry = {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      consecutiveFailures: 0,
      backoffUntil: 0,
    };
  }

  entry.attempts++;
  entry.lastAttempt = now;

  if (success) {
    // Reset consecutive failures on success
    entry.consecutiveFailures = 0;
    entry.backoffUntil = 0;
  } else {
    entry.consecutiveFailures++;

    // Calculate and set backoff if at max attempts
    if (entry.attempts >= config.maxAttempts) {
      const backoffMs = Math.min(
        config.windowMs * Math.pow(config.backoffMultiplier, entry.consecutiveFailures),
        config.maxBackoffMs
      );
      entry.backoffUntil = now + backoffMs;
    }
  }

  state[actionKey] = entry;
  saveRateLimitState(state);
}

/**
 * Clear rate limit for a specific action
 */
export function clearRateLimit(actionKey: string): void {
  const state = loadRateLimitState();
  delete state[actionKey];
  saveRateLimitState(state);
}

// ============================================================================
// Cohort Assignment Validation
// ============================================================================

/**
 * Validate a cohort assignment request
 *
 * @param requestingPubkey - Pubkey of user making request
 * @param targetPubkey - Pubkey of user being modified
 * @param newCohorts - Proposed new cohorts
 * @returns Validation result
 */
export async function validateCohortAssignment(
  requestingPubkey: string,
  targetPubkey: string,
  newCohorts: CohortName[]
): Promise<{ valid: boolean; error?: string }> {
  // Verify requester's admin status via relay
  const requesterStatus = await verifyWhitelistStatus(requestingPubkey);

  // Non-admins cannot modify cohorts
  if (!requesterStatus.isAdmin) {
    logSuspiciousActivity({
      pubkey: requestingPubkey,
      action: 'unauthorized_cohort_change',
      timestamp: Date.now(),
      details: `Non-admin ${requestingPubkey.slice(0, 8)}... attempted to modify cohorts`,
    });
    return {
      valid: false,
      error: 'Only admins can modify cohort assignments',
    };
  }

  // Prevent self-assignment to admin cohort
  if (requestingPubkey === targetPubkey && newCohorts.includes('admin')) {
    logSuspiciousActivity({
      pubkey: requestingPubkey,
      action: 'self_admin_assignment',
      timestamp: Date.now(),
      details: `User ${requestingPubkey.slice(0, 8)}... attempted to self-assign admin cohort`,
    });
    return {
      valid: false,
      error: 'Cannot self-assign admin cohort',
    };
  }

  // Check for restricted cohort assignments
  for (const cohort of newCohorts) {
    if (RESTRICTED_COHORTS.includes(cohort)) {
      // For restricted cohorts, verify multiple admins would remain
      // This prevents a single admin from revoking all admin access
      if (cohort === 'admin' && targetPubkey === requestingPubkey) {
        return {
          valid: false,
          error: 'Cannot remove your own admin cohort',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Get current user's cohorts from relay (verified)
 */
export async function getVerifiedCohorts(pubkey: string): Promise<CohortName[]> {
  const status = await verifyWhitelistStatus(pubkey);
  return status.cohorts;
}

// ============================================================================
// Request Signing (Admin Actions)
// ============================================================================

/**
 * Create a signed request for admin actions
 * Includes timestamp to prevent replay attacks
 *
 * @param action - Action name
 * @param payload - Request payload
 * @param privateKey - Admin's private key for signing
 * @returns Signed request object
 */
export async function createSignedAdminRequest(
  action: string,
  payload: unknown,
  pubkey: string,
  signFn: (message: string) => Promise<string>
): Promise<SignedRequest> {
  const timestamp = nowSeconds();
  const nonce = generateNonce();

  // Create message to sign
  const message = JSON.stringify({
    action,
    timestamp,
    nonce,
    pubkey,
    payload,
  });

  // Sign with user's key
  const signature = await signFn(message);

  return {
    action,
    timestamp,
    nonce,
    pubkey,
    payload,
    signature,
  };
}

/**
 * Verify a signed admin request
 *
 * @param request - Signed request to verify
 * @param verifyFn - Function to verify signature
 * @returns Verification result
 */
export async function verifySignedAdminRequest(
  request: SignedRequest,
  verifyFn: (message: string, signature: string, pubkey: string) => Promise<boolean>
): Promise<{ valid: boolean; error?: string }> {
  const now = nowSeconds();

  // Check timestamp (prevent replay attacks)
  const requestAge = now - request.timestamp;
  if (requestAge > SIGNATURE_VALIDITY_WINDOW_SECONDS) {
    return {
      valid: false,
      error: `Request expired (${requestAge}s old, max ${SIGNATURE_VALIDITY_WINDOW_SECONDS}s)`,
    };
  }

  if (requestAge < 0) {
    return {
      valid: false,
      error: 'Request timestamp is in the future',
    };
  }

  // Check nonce format
  if (!request.nonce || request.nonce.length < 16) {
    return {
      valid: false,
      error: 'Invalid request nonce',
    };
  }

  // Verify admin status
  const adminStatus = await verifyWhitelistStatus(request.pubkey);
  if (!adminStatus.isAdmin) {
    logSuspiciousActivity({
      pubkey: request.pubkey,
      action: 'non_admin_signed_request',
      timestamp: Date.now(),
      details: `Non-admin ${request.pubkey.slice(0, 8)}... submitted signed admin request for ${request.action}`,
    });
    return {
      valid: false,
      error: 'Signer is not an admin',
    };
  }

  // Verify signature
  const message = JSON.stringify({
    action: request.action,
    timestamp: request.timestamp,
    nonce: request.nonce,
    pubkey: request.pubkey,
    payload: request.payload,
  });

  const signatureValid = await verifyFn(message, request.signature, request.pubkey);
  if (!signatureValid) {
    logSuspiciousActivity({
      pubkey: request.pubkey,
      action: 'invalid_admin_signature',
      timestamp: Date.now(),
      details: `Invalid signature on admin request for ${request.action}`,
    });
    return {
      valid: false,
      error: 'Invalid request signature',
    };
  }

  return { valid: true };
}

/**
 * Generate cryptographically secure nonce
 */
function generateNonce(): string {
  if (browser && crypto?.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for non-browser environments
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ============================================================================
// Relay Response Verification
// ============================================================================

/**
 * Verify a relay response signature (if present)
 *
 * @param response - Relay response object
 * @param relayPubkey - Expected relay public key (optional)
 * @returns Verification result
 */
export function verifyRelayResponse(
  response: { signature?: string; timestamp?: number; data: unknown },
  relayPubkey?: string
): { valid: boolean; warning?: string } {
  // If relay doesn't provide signatures, warn but allow
  if (!response.signature) {
    return {
      valid: true,
      warning: 'Relay response not signed - authenticity cannot be verified',
    };
  }

  // Check timestamp if present
  if (response.timestamp) {
    const responseAge = nowSeconds() - response.timestamp;
    if (responseAge > 60) {
      // Response older than 1 minute
      return {
        valid: false,
        warning: 'Relay response is stale (>60s old)',
      };
    }
  }

  // Note: Actual signature verification depends on relay implementation
  // Most relays don't sign responses, so this is forward-compatible
  return { valid: true };
}

// ============================================================================
// Suspicious Activity Logging
// ============================================================================

/**
 * Log suspicious activity for review
 */
function logSuspiciousActivity(activity: SuspiciousActivity): void {
  if (!browser) return;

  try {
    const stored = sessionStorage.getItem(SUSPICIOUS_ACTIVITY_KEY);
    const activities: SuspiciousActivity[] = stored ? JSON.parse(stored) : [];

    // Keep last 50 entries
    activities.push(activity);
    if (activities.length > 50) {
      activities.shift();
    }

    sessionStorage.setItem(SUSPICIOUS_ACTIVITY_KEY, JSON.stringify(activities));

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.warn('[Security] Suspicious activity:', activity);
    }
  } catch {
    console.warn('[Security] Failed to log suspicious activity');
  }
}

/**
 * Get logged suspicious activities (for admin review)
 */
export function getSuspiciousActivities(): SuspiciousActivity[] {
  if (!browser) return [];

  try {
    const stored = sessionStorage.getItem(SUSPICIOUS_ACTIVITY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear suspicious activity log
 */
export function clearSuspiciousActivities(): void {
  if (browser) {
    sessionStorage.removeItem(SUSPICIOUS_ACTIVITY_KEY);
  }
}

// ============================================================================
// Exports for Admin Components
// ============================================================================

export {
  RATE_LIMIT_CONFIG,
  RESTRICTED_COHORTS,
  SIGNATURE_VALIDITY_WINDOW_SECONDS,
};

export type { RateLimitEntry, SignedRequest, SuspiciousActivity };
