---
title: "Admin Security Hardening"
description: "This document describes the security hardening measures implemented for admin workflows in Fairfield."
category: tutorial
tags: ['admin', 'developer', 'messaging', 'security', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Admin Security Hardening

This document describes the security hardening measures implemented for admin workflows in Fairfield.

## Overview

The admin security module (`src/lib/nostr/admin-security.ts`) provides:
- Rate limiting with exponential backoff
- NIP-51 pin list signature verification
- Cryptographically signed admin requests
- Suspicious activity detection and logging
- Cohort assignment validation

## Rate Limiting

### Configuration

```typescript
const RATE_LIMIT_CONFIG = {
  sectionAccessRequest: {
    maxAttempts: 5,
    windowMs: 60 * 1000,        // 1 minute
    backoffMultiplier: 2,
    maxBackoffMs: 300 * 1000    // 5 minutes max
  },
  cohortChange: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,   // 1 hour
    backoffMultiplier: 3,
    maxBackoffMs: 24 * 60 * 60 * 1000  // 24 hours max
  },
  adminAction: {
    maxAttempts: 10,
    windowMs: 60 * 1000,        // 1 minute
    backoffMultiplier: 1.5,
    maxBackoffMs: 60 * 1000     // 1 minute max
  }
};
```

### Usage

```typescript
import { checkRateLimit } from '$lib/nostr/admin-security';

const result = checkRateLimit('cohortChange', userPubkey);

if (!result.allowed) {
  console.log(`Rate limited. Retry in ${result.retryAfterMs}ms`);
  return;
}

// Proceed with action
```

### Exponential Backoff

Failed attempts trigger exponential backoff:

```
Attempt 1: Immediate
Attempt 2: windowMs * backoffMultiplier
Attempt 3: windowMs * backoffMultiplier²
...
Capped at: maxBackoffMs
```

## NIP-51 Pin List Verification

Verifies that admin pin list events (kind 30001) are properly signed.

```typescript
import { verifyPinListSignature } from '$lib/nostr/admin-security';

const pinListEvent = {
  id: '...',
  kind: 30001,
  pubkey: adminPubkey,
  created_at: timestamp,
  content: '',
  tags: [
    ['d', 'admin-pins'],
    ['p', userPubkey1],
    ['p', userPubkey2]
  ],
  sig: '...'
};

const isValid = await verifyPinListSignature(pinListEvent);
```

### Validation Steps

1. Verify event kind is 30001
2. Verify Schnorr signature over serialized event
3. Verify pubkey matches expected admin key
4. Verify event timestamp is recent (within 24 hours)

## Signed Admin Requests

All privileged admin operations require cryptographic signatures.

### Creating Signed Requests

```typescript
import { createSignedAdminRequest } from '$lib/nostr/admin-security';

const request = await createSignedAdminRequest({
  action: 'cohort_change',
  targetPubkey: userPubkey,
  data: { cohort: 'approved' },
  adminPrivkey: adminPrivateKey
});

// Request includes:
// - timestamp
// - nonce
// - signature over action + target + data + timestamp + nonce
```

### Verifying Signed Requests

```typescript
import { verifySignedAdminRequest } from '$lib/nostr/admin-security';

const isValid = await verifySignedAdminRequest(request, expectedAdminPubkey);

if (!isValid) {
  logSuspiciousActivity({
    type: 'invalid_signature',
    actor: claimedPubkey,
    details: { action: request.action }
  });
}
```

## Suspicious Activity Detection

### Tracked Events

| Event Type | Trigger |
|------------|---------|
| `rate_limit_exceeded` | Too many requests in window |
| `invalid_signature` | Signature verification failed |
| `unauthorized_action` | Non-admin attempting admin action |
| `invalid_cohort` | Invalid cohort assignment attempt |
| `replay_attack` | Duplicate nonce detected |
| `timestamp_drift` | Request timestamp too old/future |

### Logging

```typescript
import { logSuspiciousActivity, getSuspiciousActivityLog } from '$lib/nostr/admin-security';

// Log suspicious event
logSuspiciousActivity({
  type: 'unauthorized_action',
  actor: pubkey,
  details: {
    attemptedAction: 'add_to_whitelist',
    targetUser: targetPubkey
  }
});

// Retrieve log for analysis
const recentActivity = getSuspiciousActivityLog({
  since: Date.now() - 3600000,  // Last hour
  type: 'unauthorized_action'
});
```

### Log Structure

```typescript
interface SuspiciousActivityEntry {
  timestamp: number;
  type: SuspiciousActivityType;
  actor: string;           // pubkey of actor
  details: Record<string, unknown>;
  clientInfo?: {
    userAgent: string;
    ip?: string;
  };
}
```

## Cohort Validation

Valid cohorts are strictly defined:

```typescript
const VALID_COHORTS = ['admin', 'approved', 'business', 'moomaa-tribe'];
```

### Validation Function

```typescript
import { validateCohortAssignment } from '$lib/nostr/admin-security';

const result = validateCohortAssignment({
  targetPubkey: userPubkey,
  cohort: 'approved',
  assignerPubkey: adminPubkey
});

if (!result.valid) {
  console.error(result.reason);
}
```

### Assignment Rules

1. Only admins can assign cohorts
2. Cohort must be in VALID_COHORTS list
3. Target pubkey must be valid 64-char hex
4. Cannot remove self from admin cohort

## Server-Side Verification

Admin status verification uses the relay as source of truth:

```typescript
import { verifyWhitelistStatus } from '$lib/nostr/whitelist';

// In admin route/component
const status = await verifyWhitelistStatus(userPubkey);

if (!status.isAdmin) {
  // Redirect to non-admin page
  goto('/events');
  return;
}

// Proceed with admin functionality
```

### Important

**Never rely solely on client-side stores for authorization.**

```typescript
// ❌ WRONG - Client-side only (bypassable)
if ($isAdmin) { ... }

// ✅ CORRECT - Server verification
const status = await verifyWhitelistStatus(pubkey);
if (status.isAdmin) { ... }
```

## Implementation Locations

### Files Modified for Security

| File | Change |
|------|--------|
| `src/routes/admin/+page.svelte` | Relay verification |
| `src/routes/admin/stats/+page.svelte` | Relay verification |
| `src/routes/admin/calendar/+page.svelte` | Relay verification |
| `src/routes/admin/whitelist/+page.svelte` | Relay verification |
| `src/lib/nostr/whitelist.ts` | Input validation, URL encoding |

### Security Module

`src/lib/nostr/admin-security.ts` exports:

```typescript
// Rate limiting
export { checkRateLimit, resetRateLimit, getRateLimitStatus };

// Signature verification
export { verifyPinListSignature };

// Signed requests
export { createSignedAdminRequest, verifySignedAdminRequest };

// Cohort validation
export { validateCohortAssignment, VALID_COHORTS };

// Activity logging
export { logSuspiciousActivity, getSuspiciousActivityLog, clearActivityLog };
```

## Security Fixes Applied

### HIGH-001: Admin Stats Page Authorization Bypass
- **Before**: Used client-side `$isAdmin` store
- **After**: Uses `verifyWhitelistStatus()` for server verification

### HIGH-002: Admin Calendar Page Authorization Bypass
- **Before**: Used client-side `$isAdmin` store
- **After**: Uses `verifyWhitelistStatus()` for server verification

### MED-001: URL Injection in Whitelist API
- **Before**: Direct string interpolation in URL
- **After**: Input validation + `encodeURIComponent()`

```typescript
// Input validation
if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
  return createFallbackStatus(pubkey);
}

// URL encoding
fetch(`${url}/api/check-whitelist?pubkey=${encodeURIComponent(pubkey)}`);
```

## Test Coverage

30 unit tests cover admin security:
- Rate limiting behavior
- Exponential backoff calculation
- Signature verification
- Cohort validation
- Activity logging
- Edge cases and error handling

Run tests:
```bash
npm test -- tests/unit/nostr/admin-security.test.ts
```

## Best Practices

1. **Always verify server-side** - Never trust client-side auth state
2. **Rate limit all admin actions** - Prevent brute force attacks
3. **Sign privileged requests** - Ensure non-repudiation
4. **Log suspicious activity** - Enable forensic analysis
5. **Validate all inputs** - Prevent injection attacks
6. **Use exponential backoff** - Discourage repeated abuse

## Related Documentation

- [Authentication](../features/authentication.md)
- [Security Audit Report](security-audit-report.md)
